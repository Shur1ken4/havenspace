"""Developer tool: feeds role-play audio into the app exactly as the browser
recorder would (session row + audio pieces), so the worker can be tested
without speaking into a microphone.

  uv run python tools/simulate_session.py --email demo@psych.test --client "Client A" \
      --audio .data/roleplay/01-cbt-sleep-worry --mode in_person

Synthetic/role-play audio only.
"""
from __future__ import annotations

import argparse
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from worker import config, db  # noqa: E402
from worker.storage import LocalStore  # noqa: E402

PIECE = 256 * 1024


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--email", required=True)
    ap.add_argument("--client", required=True)
    ap.add_argument("--audio", required=True, help="folder from make_roleplay_audio.py")
    ap.add_argument("--mode", choices=["in_person", "online_call", "upload"], default="in_person")
    ap.add_argument("--calibrate", action="store_true")
    a = ap.parse_args()

    conn = db.connect()
    user = conn.execute('select id from "user" where email = %s', (a.email,)).fetchone()
    if not user:
        sys.exit("No account with that email. Sign in once (or run npm run db:seed) first.")
    uid = user["id"]
    client = conn.execute("select id from clients where therapist_id = %s and pseudonym = %s", (uid, a.client)).fetchone()
    if not client:
        sys.exit("No client with that pseudonym for this therapist.")
    base = Path(a.audio) if Path(a.audio).is_absolute() else config.REPO_ROOT / a.audio
    files = {"in_person": {"room": "room.wav"}, "upload": {"upload": "room.wav"},
             "online_call": {"mic": "mic.wav", "tab": "tab.wav"}}[a.mode]
    if a.calibrate:
        files["calibration"] = "calibration.wav"

    sid = str(uuid.uuid4())
    retention = conn.execute("select audio_retention from therapists where id = %s", (uid,)).fetchone()["audio_retention"]
    conn.execute(
        "insert into sessions (id, therapist_id, client_id, capture_mode, status, audio_retention) values (%s, %s, %s, %s, 'recording', %s)",
        (sid, uid, client["id"], a.mode, retention),
    )
    store = LocalStore()
    for track, name in files.items():
        data = (base / name).read_bytes()
        for seq, i in enumerate(range(0, len(data), PIECE)):
            key = f"audio/{uid}/{sid}/{track}/000-{seq:06d}.bin"
            path = store.base / key
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data[i : i + PIECE])
            conn.execute(
                "insert into audio_chunks (therapist_id, session_id, track, segment, seq, path, bytes, mime) values (%s,%s,%s,0,%s,%s,%s,'audio/wav')",
                (uid, sid, track, seq, key, len(data[i : i + PIECE])),
            )
    conn.execute("update sessions set status = 'uploaded', stage = 'queued', ended_at = now() where id = %s", (sid,))
    conn.execute("insert into jobs (therapist_id, session_id, kind) values (%s, %s, 'process_session')", (uid, sid))
    print(sid)


if __name__ == "__main__":
    main()
