"""The agent pipeline (core IP). Each step is separate and testable, has a
validated output shape, and records the prompt version and model used."""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from difflib import SequenceMatcher

from .. import config
from ..log import log
from ..schemas import (NOTE_SECTIONS, Corrections, NoteOut, NoteSection, PackClient, PackOut, ReflectionItem,
                       ReflectionOut, RubricScore, TimelineEntry, TimelineOut)
from . import guardrails
from .evidence import check_reflection, check_timeline
from .prompts import load
from .providers import LLMProvider, Request

LANGUAGE_NAMES = {"en": "English", "ru": "Russian", "uk": "Ukrainian"}
SPEAKER_LABELS = {"therapist": "Therapist", "client": "Client", "client_2": "Client 2", "speaker_3": "Speaker 3",
                  "speaker_4": "Speaker 4", "recap": "Therapist's recap"}

SECTION_GUIDE = {
    "subjective": "the client's account of their experience, concerns and week, in their own terms",
    "objective": "what the therapist could observe in the session: presentation, engagement, how the client spoke (descriptive only)",
    "assessment": "descriptive summary of progress and themes; '[Therapist to complete]' where clinical judgement is needed",
    "plan": "what was agreed: homework, focus for next session, any follow-up the therapist mentioned",
    "data": "what the client said and what was observed in the session",
    "behaviour": "how the client presented and what they brought to the session",
    "intervention": "what the therapist did (approaches, techniques, questions, psychoeducation)",
    "response": "how the client responded to the interventions",
    "summary": "a short narrative summary of the session",
    "themes": "the main themes the client explored",
    "interventions": "what the therapist did in the session",
    "next_steps": "what was agreed for next time",
}


@dataclass
class SessionContext:
    segments: list[dict]                       # {idx, speaker, start_ms, text}
    note_format: str = "SOAP"
    language: str = "en"
    client_label: str = "the client"
    is_recap: bool = False
    previous_notes: list[str] = field(default_factory=list)
    growth_history: list[str] = field(default_factory=list)
    existing_timeline: list[str] = field(default_factory=list)

    @property
    def language_name(self) -> str:
        return LANGUAGE_NAMES.get(self.language, "English")

    def segment_texts(self) -> dict[int, str]:
        return {s["idx"]: s["text"] for s in self.segments}


def _clock(ms: int) -> str:
    s = ms // 1000
    return f"{s // 60:02d}:{s % 60:02d}"


def transcript_block(ctx: SessionContext) -> str:
    """The shared context sent with every step (cached by the API between steps)."""
    head = "Therapist's written recap of the session:" if ctx.is_recap else "Session transcript:"
    lines = [f"[{s['idx']}] ({_clock(s['start_ms'])}) {SPEAKER_LABELS.get(s['speaker'], s['speaker'])}: {s['text']}"
             for s in ctx.segments]
    parts = [head, "\n".join(lines)]
    if ctx.previous_notes:
        parts.append("Earlier approved notes for this client (most recent first), for continuity only:\n\n"
                     + "\n\n---\n\n".join(ctx.previous_notes[:3]))
    return "\n\n".join(parts)


def _system() -> str:
    return load("system").body


# ── 1. clean_transcript ──────────────────────────────────────────────────────
def clean_transcript(p: LLMProvider, ctx: SessionContext) -> list[dict]:
    """Returns segments with obvious ASR errors fixed. A correction is applied only
    if it stays close to the original — the model cannot rewrite what was said."""
    if p.is_demo or ctx.is_recap:
        return ctx.segments
    out = p.structured(Request(
        system=_system(), shared_context=transcript_block(ctx), instructions=load("clean_transcript").body,
        schema=Corrections, model=config.LLM_MODEL_LIGHT, effort="low",
    ))
    by_idx = {s["idx"]: s for s in ctx.segments}
    applied = 0
    for c in out.corrections:
        seg = by_idx.get(c.idx)
        if seg and c.text.strip() and SequenceMatcher(None, seg["text"], c.text).ratio() >= 0.6:
            seg["original_text"] = seg.get("original_text") or seg["text"]
            seg["text"] = c.text.strip()
            applied += 1
    log("step.clean_transcript", count=applied)
    return list(by_idx.values())


# ── 2. draft_note ────────────────────────────────────────────────────────────
def draft_note(p: LLMProvider, ctx: SessionContext) -> NoteOut:
    keys = NOTE_SECTIONS.get(ctx.note_format, NOTE_SECTIONS["SOAP"])
    if p.is_demo:
        return _demo_note(ctx, keys)
    guide = "\n".join(f"- {k}: {SECTION_GUIDE[k]}" for k in keys)
    instructions = load("draft_note").render(
        format_name=ctx.note_format, section_guide=guide, client_label=ctx.client_label, language_name=ctx.language_name,
    )
    req = Request(system=_system(), shared_context=transcript_block(ctx), instructions=instructions,
                  schema=NoteOut, model=config.LLM_MODEL, effort="medium")
    note = _ensure_sections(p.structured(req), keys)
    found = guardrails.hits(" ".join(s.text for s in note.sections))
    if found:
        log("guardrail.note", term_hits=len(found))
        req.instructions += ("\n\nImportant: your previous draft used diagnosis or risk-rating language. "
                             "Rewrite without any diagnostic labels or risk ratings; record only what was said.")
        note = _ensure_sections(p.structured(req), keys)
        log("guardrail.note_retry", term_hits=len(guardrails.hits(" ".join(s.text for s in note.sections))))
    return note


def _ensure_sections(note: NoteOut, keys: list[str]) -> NoteOut:
    by_key = {s.key: s.text for s in note.sections}
    return NoteOut(sections=[NoteSection(key=k, text=by_key.get(k, "[check]")) for k in keys])


# ── 3. reflect ───────────────────────────────────────────────────────────────
def reflect(p: LLMProvider, ctx: SessionContext, pack: dict) -> tuple[ReflectionOut, int]:
    dims = {d["id"] for d in pack["dimensions"]}
    if p.is_demo:
        out = _demo_reflection(ctx, pack)
    else:
        history = ("Themes from this therapist's earlier reflections (to notice growth, not to repeat):\n- "
                   + "\n- ".join(ctx.growth_history[:6])) if ctx.growth_history else ""
        pack_view = {k: pack[k] for k in ("name", "description", "scale", "dimensions")}
        instructions = load("reflect").render(pack_json=json.dumps(pack_view, ensure_ascii=False, indent=1),
                                              growth_history=history, language_name=ctx.language_name)
        out = p.structured(Request(system=_system(), shared_context=transcript_block(ctx), instructions=instructions,
                                   schema=ReflectionOut, model=config.LLM_MODEL, effort="high"))
        text = " ".join(i.text for i in out.strengths + out.missed_openings + out.try_next)
        if guardrails.hits(text):
            log("guardrail.reflection", term_hits=len(guardrails.hits(text)))
    checked, dropped = check_reflection(out, ctx.segment_texts(), dims)
    log("step.reflect", items=len(checked.strengths) + len(checked.missed_openings) + len(checked.try_next), dropped=dropped)
    return checked, dropped


# ── 4. update_client_timeline ────────────────────────────────────────────────
def update_timeline(p: LLMProvider, ctx: SessionContext) -> tuple[TimelineOut, int]:
    if p.is_demo:
        out = _demo_timeline(ctx)
    else:
        existing = "\n".join(f"- {t}" for t in ctx.existing_timeline) or "(nothing yet)"
        instructions = load("update_timeline").render(existing=existing, language_name=ctx.language_name)
        out = p.structured(Request(system=_system(), shared_context=transcript_block(ctx), instructions=instructions,
                                   schema=TimelineOut, model=config.LLM_MODEL_LIGHT, effort="low"))
    checked, dropped = check_timeline(out, ctx.segment_texts())
    existing_lower = {t.lower() for t in ctx.existing_timeline}
    for kind in ("themes", "goals", "homework", "changes"):
        setattr(checked, kind, [e for e in getattr(checked, kind) if e.text.lower() not in existing_lower])
    return checked, dropped


# ── supervision pack ─────────────────────────────────────────────────────────
def supervision_pack(p: LLMProvider, month: str, language: str, material: str) -> PackOut:
    if p.is_demo:
        return PackOut(
            overview="[Demo] This overview would summarise the month's client work. Add an AI provider in .env to generate it.",
            clients=[], growth_themes=["[Demo] Growth themes appear here."],
            questions_for_supervision=["[Demo] What felt most alive in your work this month?"],
        )
    instructions = load("supervision_pack").render(month=month, language_name=LANGUAGE_NAMES.get(language, "English"))
    return p.structured(Request(system=_system(), shared_context=material, instructions=instructions,
                                schema=PackOut, model=config.LLM_MODEL, effort="medium"))


# ── Demo outputs (no AI): clearly marked, but real citations so the UI works ──
def _pick(ctx: SessionContext, speaker: str, n: int) -> list[dict]:
    pool = [s for s in ctx.segments if s["speaker"] == speaker and len(s["text"].split()) >= 4] or ctx.segments
    step = max(1, len(pool) // (n + 1))
    return [pool[min(len(pool) - 1, step * (i + 1))] for i in range(n)]


def _short_quote(text: str) -> str:
    return " ".join(text.split()[:12])


def _demo_note(ctx: SessionContext, keys: list[str]) -> NoteOut:
    client_lines = [s["text"] for s in ctx.segments if s["speaker"] != "therapist"][:3]
    first = " ".join(client_lines)[:300]
    sections = []
    for k in keys:
        if k in ("subjective", "data", "behaviour", "summary"):
            text = f"[Demo draft — no AI connected] The client described: {first} [check]"
        elif k == "plan" or k == "next_steps":
            text = "[Demo draft] Next steps agreed in the session would appear here. [Therapist to complete]"
        else:
            text = "[Demo draft] [Therapist to complete]"
        sections.append(NoteSection(key=k, text=text))
    return NoteOut(sections=sections)


def _demo_reflection(ctx: SessionContext, pack: dict) -> ReflectionOut:
    th = _pick(ctx, "therapist", 4)
    cl = _pick(ctx, "client", 2)
    item = lambda seg, text: ReflectionItem(text=text, segment_ids=[seg["idx"]], quote=_short_quote(seg["text"]))
    return ReflectionOut(
        strengths=[item(s, "[Demo] A strength you showed at this moment would be described here.") for s in th[:3]],
        missed_openings=[item(s, "[Demo] An opening the client offered here might be worth revisiting.") for s in cl[:2]],
        try_next=[item(th[3], "[Demo] One small thing to try next time would be suggested here.")],
        rubric=[RubricScore(dimension_id=d["id"], score=3, rationale="[Demo] Placeholder score — connect an AI provider for real reflection.",
                            segment_ids=[th[0]["idx"]]) for d in pack["dimensions"]],
    )


def _demo_timeline(ctx: SessionContext) -> TimelineOut:
    seg = _pick(ctx, "client", 1)[0]
    return TimelineOut(themes=[TimelineEntry(text="[Demo] Theme from this session", segment_ids=[seg["idx"]])],
                       goals=[], homework=[], changes=[])


__all__ = ["SessionContext", "clean_transcript", "draft_note", "reflect", "update_timeline", "supervision_pack",
           "transcript_block", "PackClient"]
