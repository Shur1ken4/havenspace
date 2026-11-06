"""AI usage counts (llm_usage): saved per call, counts only, and never able to stop a session."""
import secrets
from types import SimpleNamespace

from pydantic import BaseModel

from worker.agent.providers import LLMProvider, Request, _usage_owner, charge_usage_to


class Out(BaseModel):
    text: str


class Fake(LLMProvider):
    name = "anthropic"

    def __init__(self, replies):
        self.replies = list(replies)

    def _call(self, req, extra_user):
        text = self.replies.pop(0)
        self._record_usage(req, SimpleNamespace(model="claude-opus-5-5", usage=SimpleNamespace(
            input_tokens=10, output_tokens=20, cache_creation_input_tokens=30, cache_read_input_tokens=None)))
        return text, "end_turn"


def request():
    return Request(system="SECRET", shared_context="SECRET", instructions="SECRET", schema=Out, model="m", step="reflect")


def _therapist(conn):
    uid = secrets.token_hex(8)
    conn.execute('insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") values (%s, %s, %s, true, now(), now())',
                 (uid, "T", f"{uid}@example.test"))
    conn.execute("insert into therapists (id, onboarding_completed_at, access_status) values (%s, now(), 'approved')", (uid,))
    return uid


def _rows(conn, uid):
    return conn.execute("select * from llm_usage where therapist_id = %s", (uid,)).fetchall()


def test_saves_counts_for_every_call_including_the_retry(conn):
    uid = _therapist(conn)
    charge_usage_to(conn, uid)
    Fake(["not json", '{"text": "ok"}']).structured(request())
    rows = _rows(conn, uid)
    assert len(rows) == 2
    assert (rows[0]["step"], rows[0]["provider"], rows[0]["model_id"]) == ("reflect", "anthropic", "claude-opus-5-5")
    assert (rows[0]["input_tokens"], rows[0]["output_tokens"]) == (10, 20)
    assert (rows[0]["cache_write_tokens"], rows[0]["cache_read_tokens"]) == (30, 0)
    assert "SECRET" not in str(rows)


def test_a_failed_save_does_not_stop_the_session(conn):
    charge_usage_to(conn, "no-such-therapist")
    assert Fake(['{"text": "ok"}']).structured(request()).text == "ok"


def test_nothing_is_saved_without_an_owner(conn):
    _usage_owner.set(None)
    before = conn.execute("select count(*) as n from llm_usage").fetchone()["n"]
    Fake(['{"text": "ok"}']).structured(request())
    assert conn.execute("select count(*) as n from llm_usage").fetchone()["n"] == before
