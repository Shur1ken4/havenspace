from worker.agent.evidence import check_reflection, check_timeline, normalise, quote_supported
from worker.schemas import ReflectionItem, ReflectionOut, RubricScore, TimelineEntry, TimelineOut

SEGMENTS = {
    0: "Welcome back. How has the week been?",
    1: "Honestly, not great. I didn't sleep at all — work was really busy.",
    2: "So sleep has been hard, and work is a big part of it.",
}


def item(ids, quote, text="x"):
    return ReflectionItem(text=text, segment_ids=ids, quote=quote)


def test_exact_and_normalised_quotes_pass():
    assert quote_supported("I didn't sleep at all", [1], SEGMENTS)
    assert quote_supported("i didn’t sleep at all - work was", [1], SEGMENTS)  # curly quote, dash, case


def test_quote_must_come_from_cited_segment():
    assert not quote_supported("I didn't sleep at all", [0], SEGMENTS)


def test_missing_segment_or_invented_words_fail():
    assert not quote_supported("I didn't sleep", [9], SEGMENTS)
    assert not quote_supported("I slept beautifully", [1], SEGMENTS)
    assert not quote_supported("", [1], SEGMENTS)


def test_quote_may_span_cited_segments_and_use_ellipsis():
    assert quote_supported("work was really busy. So sleep has been hard", [1, 2], SEGMENTS)
    assert quote_supported("Honestly ... work was really busy", [1], SEGMENTS)


def test_check_reflection_drops_unsupported_items_and_counts_them():
    out = ReflectionOut(
        strengths=[item([2], "sleep has been hard"), item([0], "made up words")],
        missed_openings=[item([1], "work was really busy")],
        try_next=[item([5], "nothing")],
        rubric=[RubricScore(dimension_id="agenda", score=3, rationale="r", segment_ids=[0, 99]),
                RubricScore(dimension_id="not_a_dimension", score=3, rationale="r", segment_ids=[0])],
    )
    checked, dropped = check_reflection(out, SEGMENTS, {"agenda"})
    assert len(checked.strengths) == 1
    assert len(checked.try_next) == 0
    assert checked.rubric[0].segment_ids == [0]   # invalid id removed, score kept
    assert dropped == 3                            # 1 strength + 1 try_next + 1 unknown dimension


def test_check_timeline_requires_existing_segments():
    out = TimelineOut(themes=[TimelineEntry(text="Sleep", segment_ids=[1]), TimelineEntry(text="Ghost", segment_ids=[42])],
                      goals=[], homework=[], changes=[])
    checked, dropped = check_timeline(out, SEGMENTS)
    assert [t.text for t in checked.themes] == ["Sleep"]
    assert dropped == 1


def test_normalise_handles_cyrillic():
    assert normalise("«Я НЕ спал»") == "я не спал"
