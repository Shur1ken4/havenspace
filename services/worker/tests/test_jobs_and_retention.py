from pathlib import Path

from worker import db, retention
from worker.agent.providers import Demo
from worker.pipeline import run_agent


def _session(conn, therapist, client, **cols):
    keys = ["therapist_id", "client_id", "capture_mode", *cols]
    vals = [therapist, client, "in_person", *cols.values()]
    sql = f"insert into sessions ({', '.join(keys)}) values ({', '.join(['%s'] * len(vals))}) returning id"
    return conn.execute(sql, vals).fetchone()["id"]


def _chunk(conn, storage_dir, therapist, sid, name):
    key = f"audio/{therapist}/{sid}/room/{name}"
    p = Path(storage_dir) / key
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(b"audio")
    conn.execute("insert into audio_chunks (therapist_id, session_id, track, seq, path, bytes, mime) values (%s,%s,'room',%s,%s,5,'audio/wav')",
                 (therapist, sid, int(name.split('-')[1].split('.')[0]), key))
    return p


def test_retention_deletes_expired_audio_and_keeps_current(conn, storage_dir, therapist, client_with_consent):
    expired = _session(conn, therapist, client_with_consent, status="ready")
    conn.execute("update sessions set audio_delete_after = now() - interval '1 minute' where id = %s", (expired,))
    kept = _session(conn, therapist, client_with_consent, status="ready")
    conn.execute("update sessions set audio_delete_after = now() + interval '6 days' where id = %s", (kept,))
    old_file = _chunk(conn, storage_dir, therapist, expired, "000-000000.bin")
    new_file = _chunk(conn, storage_dir, therapist, kept, "000-000000.bin")

    retention.run(conn)

    assert not old_file.exists()
    assert new_file.exists()
    assert conn.execute("select audio_deleted_at from sessions where id = %s", (expired,)).fetchone()["audio_deleted_at"]
    assert conn.execute("select count(*) n from audio_chunks where session_id = %s and deleted_at is null", (expired,)).fetchone()["n"] == 0


def test_retention_cleans_up_abandoned_recordings(conn, storage_dir, therapist, client_with_consent):
    sid = _session(conn, therapist, client_with_consent, status="recording")
    f = _chunk(conn, storage_dir, therapist, sid, "000-000000.bin")
    conn.execute("update audio_chunks set created_at = now() - interval '3 days' where session_id = %s", (sid,))
    retention.run(conn)
    assert not f.exists()


def test_two_workers_never_claim_the_same_job(therapist):
    a, b = db.connect(), db.connect()
    try:
        for _ in range(2):
            a.execute("insert into jobs (therapist_id, kind) values (%s, 'enrol_voice')", (therapist,))
        with a.transaction():
            ja = db.claim_job(a)
            jb = db.claim_job(b)
        assert ja and jb and ja["id"] != jb["id"]
    finally:
        a.close(); b.close()


def test_demo_pipeline_writes_note_reflection_and_cited_timeline(conn, therapist, client_with_consent):
    sid = _session(conn, therapist, client_with_consent, status="processing")
    lines = [("therapist", "How has your week been since we last met?"),
             ("client", "I have been sleeping badly and worrying about work every night."),
             ("therapist", "That sounds exhausting. What happens when you lie awake?"),
             ("client", "I check my emails and then I can't settle again for hours."),
             ("therapist", "Would you be willing to leave the phone in the kitchen this week?")]
    for i, (sp, text) in enumerate(lines):
        conn.execute("insert into transcript_segments (therapist_id, session_id, idx, speaker, start_ms, end_ms, text) values (%s,%s,%s,%s,%s,%s,%s)",
                     (therapist, sid, i, sp, i * 5000, i * 5000 + 4000, text))
    run_agent(conn, sid, Demo())
    s = conn.execute("select status from sessions where id = %s", (sid,)).fetchone()
    note = conn.execute("select content_json, prompt_version from notes where session_id = %s", (sid,)).fetchone()
    refl = conn.execute("select content_json, dropped_items from reflections where session_id = %s", (sid,)).fetchone()
    assert s["status"] == "ready"
    assert [x["key"] for x in note["content_json"]["sections"]] == ["subjective", "objective", "assessment", "plan"]
    assert "draft_note@" in note["prompt_version"]
    assert refl["dropped_items"] == 0 and len(refl["content_json"]["strengths"]) == 3
    assert conn.execute("select count(*) n from client_timeline_items where session_id = %s", (sid,)).fetchone()["n"] >= 1


def test_retention_removes_empty_abandoned_sessions(conn, therapist, client_with_consent):
    sid = _session(conn, therapist, client_with_consent, status="draft")
    conn.execute("update sessions set created_at = now() - interval '2 days' where id = %s", (sid,))
    keep = _session(conn, therapist, client_with_consent, status="draft")
    retention.run(conn)
    assert conn.execute("select count(*) n from sessions where id = %s", (sid,)).fetchone()["n"] == 0
    assert conn.execute("select count(*) n from sessions where id = %s", (keep,)).fetchone()["n"] == 1
