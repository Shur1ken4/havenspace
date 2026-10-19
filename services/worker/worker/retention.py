"""Scheduled clean-up. Runs every few minutes from the worker loop.

- Audio kept "for 7 days" is hard-deleted once that time has passed.
- Audio from sessions that never finished processing is deleted after 48 hours.
- Voice-enrolment samples are deleted after 1 hour if somehow left behind.
- Sessions started but never recorded are removed after 24 hours.
- Expired sign-in tokens and sessions are removed.
- Therapist verification documents are deleted 30 days after the access decision.
- Unused client invites are removed a day after they expire.
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
            or (a.track = 'dictation' and a.created_at < now() - interval '1 hour')
            or (a.track like 'live\\_%%' and a.created_at < now() - interval '10 minutes'))
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
    # Sessions that were started but never recorded or written (e.g. the therapist went back).
    conn.execute(
        """delete from sessions s where s.status = 'draft' and s.created_at < now() - interval '24 hours'
             and s.recap_text is null and not exists (select 1 from audio_chunks a where a.session_id = s.id)"""
    )
    docs = conn.execute(
        """select d.id, d.path from therapist_documents d join therapists t on t.id = d.therapist_id
            where d.deleted_at is null and t.access_status <> 'pending'
              and t.access_decided_at < now() - interval '30 days'"""
    ).fetchall()
    if docs:
        store().remove([r["path"] for r in docs])
        conn.execute("update therapist_documents set deleted_at = now() where id = any(%s)", ([r["id"] for r in docs],))
        log("retention.documents_deleted", deleted=len(docs))
    # Pilot database storage: nothing stays longer than 48 hours, whatever happened.
    conn.execute("delete from blob_store where created_at < now() - interval '48 hours'")
    conn.execute("delete from client_invites where used_at is null and expires_at < now() - interval '1 day'")
    conn.execute('delete from "verification" where "expiresAt" < now()')
    conn.execute('delete from "session" where "expiresAt" < now()')
    # Rows for deleted audio carry no content; drop them after 30 days.
    conn.execute("delete from audio_chunks where deleted_at < now() - interval '30 days'")
    if rows:
        log("retention.deleted", deleted=len(rows))
    return len(rows)
