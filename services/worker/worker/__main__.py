"""Worker loop: `npm run worker` (or `uv run python -m worker`)."""
from __future__ import annotations

import signal
import threading
import time
import traceback
from pathlib import Path

import psycopg

from . import config, db, pipeline, retention
from .agent.providers import InvalidOutputError, RefusalError, get_provider
from .log import log

POLL_SECONDS = 2
RETENTION_EVERY = 300
MAX_ATTEMPTS = 2

_stop = False


_live_stop = threading.Event()


def _handle_stop(*_: object) -> None:
    global _stop
    _stop = True
    _live_stop.set()


def handle(conn, job: dict, provider) -> None:
    kind = job["kind"]
    if kind == "process_session":
        pipeline.process_session(conn, job, provider)
    elif kind == "regenerate":
        pipeline.run_agent(conn, job["session_id"], provider)
    elif kind == "enrol_voice":
        pipeline.enrol_voice(conn, job)
    elif kind == "transcribe_dictation":
        pipeline.transcribe_dictation(conn, job)
    elif kind == "supervision_pack":
        pipeline.build_supervision_pack(conn, job, provider)


def _where(err: BaseException) -> str:
    """Where it broke (file:line function), for our own code and the innermost frame. Code locations only, never content."""
    frames = traceback.extract_tb(err.__traceback__)
    ours = [f for f in frames if "/worker/" in f.filename and "site-packages" not in f.filename]
    pick = [ours[-1]] if ours else []
    if frames and (not ours or frames[-1] is not ours[-1]):
        pick.append(frames[-1])
    return " > ".join(f"{Path(f.filename).name}:{f.lineno} {f.name}" for f in pick)


def main() -> None:
    signal.signal(signal.SIGINT, _handle_stop)
    signal.signal(signal.SIGTERM, _handle_stop)
    provider = get_provider()
    conn = db.connect()
    log("worker.start", provider=provider.name)
    if config.LIVE_RESEARCH:
        from .live import LiveRunner

        LiveRunner(provider, _live_stop).start()
    last_retention = 0.0
    while not _stop:
        try:
            if conn.closed:
                conn = db.connect()
            if time.time() - last_retention > RETENTION_EVERY:
                retention.run(conn)
                last_retention = time.time()
            job = db.claim_job(conn)
        except psycopg.OperationalError:
            # The database dropped the connection (e.g. a hosted database paused); reconnect shortly.
            log("worker.reconnect")
            time.sleep(5)
            try:
                conn = db.connect()
            except psycopg.OperationalError:
                pass
            continue
        if job is None:
            time.sleep(POLL_SECONDS)
            continue
        log("job.start", job=job["id"], kind=job["kind"], attempt=job["attempts"])
        try:
            handle(conn, job, provider)
            db.finish_job(conn, job["id"])
            log("job.done", job=job["id"], kind=job["kind"])
        except Exception as err:  # noqa: BLE001 — report the class name only, never content
            code = type(err).__name__
            permanent = isinstance(err, (pipeline.NoSpeechError, RefusalError, InvalidOutputError))
            retry = not permanent and job["attempts"] < MAX_ATTEMPTS
            log("job.error", job=job["id"], kind=job["kind"], error=code, where=_where(err), attempt=job["attempts"])
            db.fail_job(conn, job, code, retry)
            if not retry and job["session_id"] and job["kind"] in ("process_session", "regenerate"):
                conn.execute(
                    "update sessions set status = case when %s = 'regenerate' then 'ready' else 'failed' end, "
                    "stage = null, error_code = %s where id = %s",
                    (job["kind"], code, job["session_id"]),
                )
    conn.close()
    log("worker.stop")


if __name__ == "__main__":
    main()
