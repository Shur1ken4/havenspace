"""Shapes of every AI output. Each step's reply is validated against these;
invalid output is retried once. Mirrored in apps/web/src/lib/types.ts."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

NOTE_SECTIONS: dict[str, list[str]] = {
    "SOAP": ["subjective", "objective", "assessment", "plan"],
    "DAP": ["data", "assessment", "plan"],
    "BIRP": ["behaviour", "intervention", "response", "plan"],
    "FREE": ["summary", "themes", "interventions", "next_steps"],
}


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


# ── clean_transcript ─────────────────────────────────────────────────────────
class Correction(Strict):
    idx: int = Field(description="Segment number, exactly as given in the transcript")
    text: str = Field(description="The corrected text for the whole segment")


class Corrections(Strict):
    corrections: list[Correction]


# ── draft_note ───────────────────────────────────────────────────────────────
class NoteSection(Strict):
    key: str
    text: str


class NoteOut(Strict):
    sections: list[NoteSection]


# ── reflect ──────────────────────────────────────────────────────────────────
class ReflectionItem(Strict):
    text: str = Field(description="The observation, written warmly to the therapist in the second person")
    segment_ids: list[int] = Field(description="Segment numbers this observation is based on")
    quote: str = Field(description="A short exact quote (max ~25 words) copied word-for-word from one of the cited segments")


class RubricScore(Strict):
    dimension_id: str
    score: int = Field(description="1 to 5")
    rationale: str
    segment_ids: list[int]

    @field_validator("score")
    @classmethod
    def in_range(cls, v: int) -> int:
        if not 1 <= v <= 5:
            raise ValueError("score must be 1-5")
        return v


class ReflectionOut(Strict):
    strengths: list[ReflectionItem]
    missed_openings: list[ReflectionItem]
    try_next: list[ReflectionItem]
    rubric: list[RubricScore]


# ── update_client_timeline ───────────────────────────────────────────────────
class TimelineEntry(Strict):
    text: str = Field(description="A short phrase in the therapist's words, e.g. 'Sleep difficulties'")
    segment_ids: list[int]


class TimelineOut(Strict):
    themes: list[TimelineEntry]
    goals: list[TimelineEntry]
    homework: list[TimelineEntry]
    changes: list[TimelineEntry]


# ── supervision pack ─────────────────────────────────────────────────────────
class PackClient(Strict):
    pseudonym: str
    summary: str


class PackOut(Strict):
    overview: str
    clients: list[PackClient]
    growth_themes: list[str]
    questions_for_supervision: list[str]


Kind = Literal["themes", "goals", "homework", "changes"]
