"""Database access for the worker (uses the worker_user role, which bypasses
row-level security because it processes every therapist's jobs)."""
from __future__ import annotations

import socket
from contextlib import contextmanager
from typing import Iterator

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from . import config

WORKER_ID = f"{socket.gethostname()}:{id(object())}"


def connect() -> psycopg.Connection:
    return psycopg.connect(config.DATABASE_URL, row_factory=dict_row, autocommit=True)


@contextmanager
def transaction(conn: psycopg.Connection) -> Iterator[psycopg.Cursor]:
    with conn.transaction():
        with conn.cursor() as cur:
            yield cur


def claim_job(conn: psycopg.Connection) -> dict | None:
    """Takes the oldest ready job. SKIP LOCKED lets several workers run safely."""
    with transaction(conn) as cur:
        # Jobs stuck "running" for 30 minutes (worker crashed) go back in the queue.
        cur.execute(
            "update jobs set status = 'queued', locked_at = null, locked_by = null "
            "where status = 'running' and locked_at < now() - interval '30 minutes'"
        )
        cur.execute(
            """
            update jobs set status = 'running', attempts = attempts + 1, locked_at = now(), locked_by = %s
             where id = (select id from jobs where status = 'queued' and run_after <= now()
                          order by id for update skip locked limit 1)
            returning id, kind, therapist_id, session_id, payload, attempts
            """,
            (WORKER_ID,),
        )
        return cur.fetchone()


def finish_job(conn: psycopg.Connection, job_id: int) -> None:
    conn.execute("update jobs set status = 'done', locked_at = null where id = %s", (job_id,))


def fail_job(conn: psycopg.Connection, job: dict, error_code: str, retry: bool) -> None:
    if retry:
        conn.execute(
            "update jobs set status = 'queued', run_after = now() + interval '30 seconds', error_code = %s, "
            "locked_at = null where id = %s",
            (error_code, job["id"]),
        )
    else:
        conn.execute("update jobs set status = 'failed', error_code = %s, locked_at = null where id = %s",
                     (error_code, job["id"]))


def set_stage(conn: psycopg.Connection, session_id: str, stage: str, status: str = "processing") -> None:
    conn.execute("update sessions set status = %s, stage = %s where id = %s", (status, stage, session_id))


def audit(conn: psycopg.Connection, therapist_id: str, action: str, entity_type: str, entity_id: str | None) -> None:
    conn.execute(
        "insert into audit_log (therapist_id, actor, action, entity_type, entity_id) values (%s, 'worker', %s, %s, %s)",
        (therapist_id, action, entity_type, entity_id),
    )


__all__ = ["connect", "transaction", "claim_job", "finish_job", "fail_job", "set_stage", "audit", "Jsonb"]
