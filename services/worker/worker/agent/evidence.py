"""evidence_check: plain code, not AI. Every reflection or timeline item must
point at segments that exist, and its quote must really appear in them.
Items that fail are dropped and counted (never logged with content)."""
from __future__ import annotations

import re
import unicodedata

from ..schemas import ReflectionItem, ReflectionOut, TimelineEntry, TimelineOut

_QUOTES = str.maketrans({"’": "'", "‘": "'", "“": '"', "”": '"', "«": '"', "»": '"', "—": "-", "–": "-", "…": "..."})


def normalise(text: str) -> str:
    text = unicodedata.normalize("NFKC", text).translate(_QUOTES).lower()
    text = re.sub(r"[^\w\s']", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def quote_supported(quote: str, segment_ids: list[int], segments: dict[int, str]) -> bool:
    if not segment_ids or any(i not in segments for i in segment_ids):
        return False
    q = normalise(quote)
    if len(q) < 3:
        return False
    # Allow a quote that spans neighbouring cited segments.
    haystack = " ".join(normalise(segments[i]) for i in sorted(set(segment_ids)))
    if q in haystack:
        return True
    # Models sometimes elide with "..."; accept if every fragment is present in order.
    parts = [p for p in (normalise(x) for x in re.split(r"\.\.\.|…", quote)) if len(p) >= 3]
    pos = 0
    for p in parts:
        found = haystack.find(p, pos)
        if found < 0:
            return False
        pos = found + len(p)
    return bool(parts)


def check_reflection(out: ReflectionOut, segments: dict[int, str], dimension_ids: set[str]) -> tuple[ReflectionOut, int]:
    dropped = 0

    def keep(items: list[ReflectionItem]) -> list[ReflectionItem]:
        nonlocal dropped
        ok = [it for it in items if quote_supported(it.quote, it.segment_ids, segments)]
        dropped += len(items) - len(ok)
        return ok

    rubric = []
    for r in out.rubric:
        if r.dimension_id not in dimension_ids:
            dropped += 1
            continue
        rubric.append(r.model_copy(update={"segment_ids": [i for i in r.segment_ids if i in segments]}))
    checked = ReflectionOut(
        strengths=keep(out.strengths)[:3],
        missed_openings=keep(out.missed_openings)[:2],
        try_next=keep(out.try_next)[:1],
        rubric=rubric,
    )
    return checked, dropped


def check_timeline(out: TimelineOut, segments: dict[int, str]) -> tuple[TimelineOut, int]:
    dropped = 0

    def keep(items: list[TimelineEntry]) -> list[TimelineEntry]:
        nonlocal dropped
        ok = [it for it in items if it.segment_ids and all(i in segments for i in it.segment_ids) and it.text.strip()]
        dropped += len(items) - len(ok)
        return ok[:4]

    return TimelineOut(themes=keep(out.themes), goals=keep(out.goals), homework=keep(out.homework), changes=keep(out.changes)), dropped
