"""Scheduled clean-up. Runs every few minutes from the worker loop.

- Audio kept "for 7 days" is hard-deleted once that time has passed.
- Audio from sessions that never finished processing is deleted after 48 hours.
- Voice-enrolment samples are deleted after 1 hour if somehow left behind.
- Expired sign-in tokens and sessions are removed.
"""
from __future__ import annotations

import psycopg

from .log import log
from .storage import store


def run(conn: psycopg.Connection) -> int:
    rows = conn.execute(
        """
        select a.id, a.path from audio_chunks a left join sessions s on s.id = a.session_id
         where a.deleted_at is null and (
               (s.audio_delete_after is not null and s.audio_delete_after < now())
            or (s.id is not null and s.status <> 'ready' and a.created_at < now() - interval '48 hours')
            or (a.session_id is null and a.created_at < now() - interval '1 hour')
            or (a.track = 'dictation' and a.created_at < now() - interval '1 hour'))
        """
    ).fetchall()
    if rows:
        store().remove([r["path"] for r in rows])
        conn.execute("update audio_chunks set deleted_at = now() where id = any(%s)", ([r["id"] for r in rows],))
        conn.execute(
            """update sessions s set audio_deleted_at = now()
                where audio_deleted_at is null
                  and exists (select 1 from audio_chunks a where a.session_id = s.id)
                  and not exists (select 1 from audio_chunks a where a.session_id = s.id and a.deleted_at is null)"""
        )
    conn.execute('delete from "verification" where "expiresAt" < now()')
    conn.execute('delete from "session" where "expiresAt" < now()')
    # Rows for deleted audio carry no content; drop them after 30 days.
    conn.execute("delete from audio_chunks where deleted_at < now() - interval '30 days'")
    if rows:
        log("retention.deleted", deleted=len(rows))
    return len(rows)
