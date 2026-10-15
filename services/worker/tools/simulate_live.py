"""Developer tool: plays role-play audio into LIVE RESEARCH MODE (ADR-10) the way
the browser does during a session — one ~8 s clip per track at a time — so the
live loop can be tested without a microphone. Open the session's capture page
in the app to watch the suggestions appear.

  uv run python tools/simulate_live.py --email demo@psych.test --client "Client A" \
      --audio .data/roleplay/01-cbt-sleep-worry --mode online_call [--speed 2] [--seconds 120]

Synthetic/role-play audio only. The session is left as an empty draft
afterwards (removed by the daily clean-up) unless --keep is given.
"""
from __future__ import annotations

import argparse
import io
import sys
import time
import uuid
import wave
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from worker import config, db  # noqa: E402
from worker.storage import LocalStore  # noqa: E402


def clips(path: Path, clip_s: float) -> list[bytes]:
    with wave.open(str(path)) as w:
        params, frames = w.getparams(), w.readframes(w.getnframes())
    step = int(params.framerate * clip_s) * params.sampwidth * params.nchannels
    out = []
    for i in range(0, len(frames), step):
        buf = io.BytesIO()
        with wave.open(buf, "wb") as o:
            o.setparams(params)
            o.writeframes(frames[i : i + step])
        out.append(buf.getvalue())
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--email", required=True)
    ap.add_argument("--client", required=True)
    ap.add_argument("--audio", required=True)
    ap.add_argument("--mode", choices=["in_person", "online_call"], default="online_call")
    ap.add_argument("--speed", type=float, default=1.0, help="2 = twice as fast as real time")
    ap.add_argument("--seconds", type=float, default=0, help="stop after this much audio (0 = all)")
    ap.add_argument("--keep", action="store_true", help="keep the session open (recording) at the end")
    ap.add_argument("--session", help="feed an existing live session (e.g. one open in the browser) instead of creating one")
    a = ap.parse_args()

    conn = db.connect()
    uid = conn.execute('select id from "user" where email = %s', (a.email,)).fetchone()["id"]
    client = conn.execute("select id from clients where therapist_id = %s and pseudonym = %s", (uid, a.client)).fetchone()
    base = Path(a.audio) if Path(a.audio).is_absolute() else config.REPO_ROOT / a.audio
    tracks = {"online_call": {"live_mic": "mic.wav", "live_tab": "tab.wav"}, "in_person": {"live_room": "room.wav"}}[a.mode]
    pieces = {t: clips(base / f, config.LIVE_CLIP_MS / 1000) for t, f in tracks.items()}

    sid = a.session or str(uuid.uuid4())
    if not a.session:
        conn.execute("insert into sessions (id, therapist_id, client_id, capture_mode, status, live_research) "
                     "values (%s, %s, %s, %s, 'recording', true)", (sid, uid, client["id"], a.mode))
    print(f"session {sid}\nwatch: {config.env('APP_URL', 'http://localhost:3210')}/sessions/{sid}/capture", flush=True)
    store = LocalStore()
    n = max(len(p) for p in pieces.values())
    if a.seconds:
        n = min(n, int(a.seconds * 1000 // config.LIVE_CLIP_MS) + 1)
    for seq in range(n):
        time.sleep(config.LIVE_CLIP_MS / 1000 / a.speed)  # the clip is sent once it has been "heard"
        for track, p in pieces.items():
            if seq >= len(p):
                continue
            key = f"audio/{uid}/{sid}/{track}/900-{seq:06d}.bin"
            (store.base / key).parent.mkdir(parents=True, exist_ok=True)
            (store.base / key).write_bytes(p[seq])
            conn.execute("insert into audio_chunks (therapist_id, session_id, track, segment, seq, path, bytes, mime) "
                         "values (%s,%s,%s,900,%s,%s,%s,'audio/wav')", (uid, sid, track, seq, key, len(p[seq])))
        print(f"clip {seq + 1}/{n}", flush=True)
    time.sleep(40 / a.speed)
    lines = conn.execute("select count(*) as n from live_lines where session_id = %s", (sid,)).fetchone()["n"]
    insights = conn.execute("select count(*) as n from live_insights where session_id = %s", (sid,)).fetchone()["n"]
    left = conn.execute("select count(*) as n from audio_chunks where session_id = %s and deleted_at is null", (sid,)).fetchone()["n"]
    print(f"lines={lines} insights={insights} clips_not_deleted={left}")
    if not a.keep and not a.session:
        conn.execute("update sessions set status = 'draft' where id = %s", (sid,))


if __name__ == "__main__":
    main()
