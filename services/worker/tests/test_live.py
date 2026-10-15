"""Live research mode (ADR-10): the same evidence and guardrail rules as after the session."""
from worker.live import _checked
from worker.schemas import LiveInsightOut, LiveOpening

WINDOW = [
    {"speaker": "therapist", "text": "How has the week been?"},
    {"speaker": "client", "text": "Up and down. I didn't sleep well most nights, honestly."},
]


def test_keeps_openings_that_quote_the_client():
    out = _checked(LiveInsightOut(now="The client describes poor sleep.", idea="",
                                  openings=[LiveOpening(point="Sleep", quote="didn't sleep well most nights")]), WINDOW)
    assert out and len(out["openings"]) == 1


def test_drops_openings_with_invented_or_therapist_quotes():
    out = _checked(LiveInsightOut(now="Talking about the week.", idea="", openings=[
        LiveOpening(point="Invented", quote="I feel hopeless at work"),
        LiveOpening(point="Therapist's words", quote="How has the week been"),
    ]), WINDOW)
    assert out and out["openings"] == []


def test_drops_risk_or_diagnosis_language():
    assert _checked(LiveInsightOut(now="Overall risk level: low.", idea="", openings=[]), WINDOW) is None
    out = _checked(LiveInsightOut(now="Sleep is the theme.", idea="This meets criteria for depression.", openings=[]), WINDOW)
    assert out and out["idea"] == ""
