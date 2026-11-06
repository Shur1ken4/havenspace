"""A reflection that comes back short (fewer than 3 strengths, 2 openings, 1 next step) is asked for once more."""
import json

from worker.agent import steps
from worker.agent.providers import LLMProvider

SEGMENTS = [{"idx": 0, "speaker": "therapist", "start_ms": 0, "end_ms": 1000, "text": "How has the week been?"},
            {"idx": 1, "speaker": "client", "start_ms": 1000, "end_ms": 2000, "text": "Not great, I didn't sleep."}]
PACK = {"id": "general", "version": 1, "name": "General", "description": "", "scale": "1-5",
        "dimensions": [{"id": "listening", "name": "Listening"}]}


def item():
    return {"text": "x", "segment_ids": [1], "quote": "I didn't sleep"}


def reply(strengths, openings, nexts):
    return json.dumps({"strengths": [item()] * strengths, "missed_openings": [item()] * openings,
                       "try_next": [item()] * nexts, "rubric": []})


class Fake(LLMProvider):
    name = "anthropic"

    def __init__(self, replies):
        self.replies = list(replies)
        self.calls = 0

    def _call(self, req, extra_user):
        self.calls += 1
        return self.replies.pop(0), "end_turn"


def run(provider):
    return steps.reflect(provider, steps.SessionContext(segments=[dict(s) for s in SEGMENTS]), PACK)


def test_a_full_reflection_is_not_asked_twice():
    p = Fake([reply(3, 2, 1)])
    out, _ = run(p)
    assert p.calls == 1 and len(out.strengths) == 3


def test_a_short_reflection_is_asked_again_and_the_fuller_one_kept():
    p = Fake([reply(1, 0, 0), reply(3, 2, 1)])
    out, _ = run(p)
    assert p.calls == 2
    assert (len(out.strengths), len(out.missed_openings), len(out.try_next)) == (3, 2, 1)


def test_a_failed_second_try_keeps_the_first_reflection():
    p = Fake([reply(1, 0, 0), "not json", "still not json"])
    out, _ = run(p)
    assert p.calls == 3  # the first answer, then the retry and its own format retry
    assert len(out.strengths) == 1


def test_a_worse_second_try_does_not_replace_the_first():
    p = Fake([reply(3, 1, 1), reply(1, 0, 0)])
    out, _ = run(p)
    assert p.calls == 2
    assert (len(out.strengths), len(out.missed_openings), len(out.try_next)) == (3, 1, 1)
