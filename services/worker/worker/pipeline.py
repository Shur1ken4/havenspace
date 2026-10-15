"""Job handlers: process_session, regenerate, enrol_voice, transcribe_dictation, supervision_pack."""
from __future__ import annotations

import json
import time
from collections import defaultdict

import numpy as np
import psycopg

from . import audio, config, db
from .agent import steps
from .agent.prompts import combined_version
from .agent.providers import LLMProvider
from .log import log
from .storage import store


def _pack(modality: str) -> dict:
    mapping = json.loads((config.SHARED_DIR / "modalities" / "map.json").read_text())
    pack_id = mapping.get(modality, "general")
    path = config.SHARED_DIR / "modalities" / f"{pack_id}.json"
    return json.loads((path if path.exists() else config.SHARED_DIR / "modalities" / "general.json").read_text())


# ── Audio ────────────────────────────────────────────────────────────────────
def _load_tracks(conn: psycopg.Connection, session_id: str) -> tuple[dict[str, np.ndarray], list[str]]:
    """Joins each track's pieces back together. A new recorder segment (e.g.
    after a page reload) is decoded separately and appended in order."""
    rows = conn.execute(
        "select track, segment, seq, path from audio_chunks where session_id = %s and deleted_at is null "
        "and track not like 'live\\_%%' order by track, segment, seq",
        (session_id,),
    ).fetchall()
    grouped: dict[str, dict[int, list[str]]] = defaultdict(lambda: defaultdict(list))
    for r in rows:
        grouped[r["track"]][r["segment"]].append(r["path"])
    tracks: dict[str, np.ndarray] = {}
    for track, segments in grouped.items():
        parts = []
        for seg in sorted(segments):
            data = b"".join(store().get(p) for p in segments[seg])
            parts.append(audio.decode(data))
        tracks[track] = np.concatenate(parts) if parts else np.zeros(0, dtype=np.float32)
    return tracks, [r["path"] for r in rows]


def delete_session_audio(conn: psycopg.Connection, session_id: str, keys: list[str] | None = None) -> int:
    if keys is None:
        keys = [r["path"] for r in conn.execute(
            "select path from audio_chunks where session_id = %s and deleted_at is null", (session_id,)).fetchall()]
    store().remove(keys)
    conn.execute("update audio_chunks set deleted_at = now() where session_id = %s and deleted_at is null", (session_id,))
    conn.execute("update sessions set audio_deleted_at = now() where id = %s", (session_id,))
    return len(keys)


# ── process_session ──────────────────────────────────────────────────────────
def process_session(conn: psycopg.Connection, job: dict, provider: LLMProvider) -> None:
    sid = job["session_id"]
    s = conn.execute(
        """select s.*, t.note_format, t.language as t_language, t.modalities, t.voice_embedding, c.pseudonym
             from sessions s join therapists t on t.id = s.therapist_id join clients c on c.id = s.client_id
            where s.id = %s""",
        (sid,),
    ).fetchone()
    if s is None:
        return
    started = time.time()

    if s["capture_mode"] == "recap":
        segments = _recap_segments(s["recap_text"] or "")
        language = None
    else:
        db.set_stage(conn, sid, "transcribing")
        segments, language, duration = _transcribe_session(conn, s)
        if not segments:
            raise NoSpeechError("no speech found")
        if s["capture_mode"] == "upload" or not s["duration_seconds"]:
            conn.execute("update sessions set duration_seconds = %s where id = %s", (int(duration), sid))

    with db.transaction(conn) as cur:
        cur.execute("delete from transcript_segments where session_id = %s", (sid,))
        for seg in segments:
            cur.execute(
                "insert into transcript_segments (therapist_id, session_id, idx, speaker, start_ms, end_ms, text) "
                "values (%s, %s, %s, %s, %s, %s, %s)",
                (s["therapist_id"], sid, seg["idx"], seg["speaker"], seg["start_ms"], seg["end_ms"], seg["text"]),
            )
        cur.execute("update sessions set language = %s where id = %s", (language, sid))

    # Audio is deleted as soon as the transcript is safely stored (unless the
    # therapist chose to keep it for 7 days; the retention job removes it then).
    if s["capture_mode"] != "recap":
        if s["audio_retention"] == "keep_7_days":
            conn.execute("update sessions set audio_delete_after = now() + interval '7 days' where id = %s", (sid,))
        else:
            n = delete_session_audio(conn, sid)
            db.audit(conn, s["therapist_id"], "audio.delete", "session", sid)
            log("audio.deleted", session=sid, deleted=n)

    run_agent(conn, sid, provider)
    log("session.done", session=sid, seconds=round(time.time() - started, 1), segments=len(segments))


class NoSpeechError(RuntimeError):
    pass


def _recap_segments(text: str) -> list[dict]:
    paragraphs = [p.strip() for p in text.replace("\r", "").split("\n") if p.strip()]
    return [{"idx": i, "speaker": "recap", "start_ms": 0, "end_ms": 0, "text": p} for i, p in enumerate(paragraphs)]


def _transcribe_session(conn: psycopg.Connection, s: dict) -> tuple[list[dict], str | None, float]:
    from . import asr, diarization

    tracks, _ = _load_tracks(conn, s["id"])
    calibration = tracks.pop("calibration", None)
    therapist_voice = None
    if calibration is not None and audio.seconds(calibration) >= 1.5:
        therapist_voice = diarization.embed(calibration)
    elif s["voice_embedding"]:
        therapist_voice = np.array(s["voice_embedding"], dtype=np.float32)

    if "mic" in tracks or "tab" in tracks:
        mic, tab = tracks.get("mic", np.zeros(0, np.float32)), tracks.get("tab", np.zeros(0, np.float32))
        tab_segs, language = asr.transcribe(tab, split_on_pauses=True)
        mic_segs, mic_lang = asr.transcribe(mic, language=language, split_on_pauses=True)
        db.set_stage(conn, s["id"], "labelling")
        labelled = diarization.label_two_tracks(mic_segs, tab_segs)
        duration = max(audio.seconds(mic), audio.seconds(tab))
        language = language or mic_lang
    else:
        samples = tracks.get("room")
        if samples is None:
            samples = tracks.get("upload", np.zeros(0, np.float32))
        segs, language = asr.transcribe(samples, split_on_pauses=True)
        db.set_stage(conn, s["id"], "labelling")
        labelled = diarization.label_single_track(segs, samples, therapist_voice)
        duration = audio.seconds(samples)

    merged = diarization.merge_turns(labelled)
    log("asr.done", session=s["id"], segments=len(merged), language=language, tracks=len(tracks))
    return [
        {"idx": i, "speaker": m.speaker, "start_ms": int(m.start * 1000), "end_ms": int(m.end * 1000), "text": m.text}
        for i, m in enumerate(merged)
    ], language, duration


# ── Agent (also used by "Redraft") ───────────────────────────────────────────
def run_agent(conn: psycopg.Connection, sid: str, provider: LLMProvider) -> None:
    s = conn.execute(
        """select s.*, t.note_format, t.language as t_language, t.modalities, c.pseudonym
             from sessions s join therapists t on t.id = s.therapist_id join clients c on c.id = s.client_id
            where s.id = %s""",
        (sid,),
    ).fetchone()
    segments = conn.execute(
        "select idx, speaker, start_ms, end_ms, text, original_text from transcript_segments where session_id = %s order by idx",
        (sid,),
    ).fetchall()
    previous = conn.execute(
        """select n.content_json from notes n join sessions x on x.id = n.session_id
            where x.client_id = %s and n.status = 'approved' and x.id <> %s
            order by x.started_at desc limit 3""",
        (s["client_id"], sid),
    ).fetchall()
    growth = conn.execute(
        """select r.content_json from reflections r join sessions x on x.id = r.session_id
            where r.therapist_id = %s and x.id <> %s order by r.created_at desc limit 3""",
        (s["therapist_id"], sid),
    ).fetchall()
    existing = conn.execute(
        "select text from client_timeline_items where client_id = %s and status <> 'dropped'", (s["client_id"],)
    ).fetchall()

    modality = (s["modalities"] or ["general"])[0]
    ctx = steps.SessionContext(
        segments=[dict(r) for r in segments],
        note_format=s["note_format"],
        language=s["t_language"],
        client_label=s["pseudonym"],
        is_recap=s["capture_mode"] == "recap",
        previous_notes=[_note_text(p["content_json"]) for p in previous],
        growth_history=[i["text"] for g in growth for i in (g["content_json"].get("try_next", []) + g["content_json"].get("missed_openings", []))],
        existing_timeline=[e["text"] for e in existing],
    )

    db.set_stage(conn, sid, "cleaning")
    cleaned = steps.clean_transcript(provider, ctx)
    with db.transaction(conn) as cur:
        for seg in cleaned:
            if seg.get("original_text") and seg["original_text"] != seg["text"]:
                cur.execute("update transcript_segments set text = %s, original_text = %s where session_id = %s and idx = %s",
                            (seg["text"], seg["original_text"], sid, seg["idx"]))
    ctx.segments = cleaned

    db.set_stage(conn, sid, "writing_note")
    note = steps.draft_note(provider, ctx)
    model_id = provider.model_id(config.LLM_MODEL)
    conn.execute(
        """insert into notes (therapist_id, session_id, format, content_json, prompt_version, model_id)
           values (%s, %s, %s, %s, %s, %s)
           on conflict (session_id) do update set content_json = excluded.content_json, format = excluded.format,
             prompt_version = excluded.prompt_version, model_id = excluded.model_id
           where notes.status = 'draft'""",
        (s["therapist_id"], sid, s["note_format"],
         db.Jsonb({"format": s["note_format"], "sections": [x.model_dump() for x in note.sections]}),
         combined_version("draft_note"), model_id),
    )

    if not ctx.is_recap:
        db.set_stage(conn, sid, "reflecting")
        pack = _pack(modality)
        reflection, dropped = steps.reflect(provider, ctx, pack)
        conn.execute(
            """insert into reflections (therapist_id, session_id, modality, content_json, dropped_items, prompt_version, model_id)
               values (%s, %s, %s, %s, %s, %s, %s)
               on conflict (session_id) do update set content_json = excluded.content_json, modality = excluded.modality,
                 dropped_items = excluded.dropped_items, prompt_version = excluded.prompt_version, model_id = excluded.model_id""",
            (s["therapist_id"], sid, modality, db.Jsonb(reflection.model_dump()), dropped,
             combined_version("reflect") + f"+pack@{pack['id']}:{pack['version']}", model_id),
        )

    db.set_stage(conn, sid, "timeline")
    timeline, _ = steps.update_timeline(provider, ctx)
    with db.transaction(conn) as cur:
        cur.execute("delete from client_timeline_items where session_id = %s and source = 'ai'", (sid,))
        for kind_plural, kind in (("themes", "theme"), ("goals", "goal"), ("homework", "homework"), ("changes", "change")):
            for entry in getattr(timeline, kind_plural):
                cur.execute(
                    "insert into client_timeline_items (therapist_id, client_id, session_id, kind, text, evidence) "
                    "values (%s, %s, %s, %s, %s, %s)",
                    (s["therapist_id"], s["client_id"], sid, kind, entry.text,
                     db.Jsonb([{"session_id": str(sid), "segment_ids": entry.segment_ids}])),
                )
    db.set_stage(conn, sid, "done", status="ready")


def _note_text(content: dict) -> str:
    return "\n".join(f"{s['key']}: {s['text']}" for s in content.get("sections", []))


# ── enrol_voice ──────────────────────────────────────────────────────────────
def enrol_voice(conn: psycopg.Connection, job: dict) -> None:
    from . import diarization

    chunk = conn.execute("select id, path from audio_chunks where id = %s and deleted_at is null",
                         (job["payload"]["chunk_id"],)).fetchone()
    if chunk is None:
        return
    try:
        samples = audio.decode(store().get(chunk["path"]))
        if audio.seconds(samples) >= 1.5:
            emb = diarization.embed(samples)
            conn.execute("update therapists set voice_embedding = %s, voice_enrolled_at = now() where id = %s",
                         ([float(x) for x in emb], job["therapist_id"]))
    finally:
        store().remove([chunk["path"]])
        conn.execute("update audio_chunks set deleted_at = now() where id = %s", (chunk["id"],))


# ── transcribe_dictation ─────────────────────────────────────────────────────
def transcribe_dictation(conn: psycopg.Connection, job: dict) -> None:
    from . import asr

    sid = job["session_id"]
    segment = int(job["payload"].get("segment", 0))
    rows = conn.execute(
        "select path from audio_chunks where session_id = %s and track = 'dictation' and segment = %s and deleted_at is null order by seq",
        (sid, segment),
    ).fetchall()
    keys = [r["path"] for r in rows]
    try:
        samples = audio.decode(b"".join(store().get(k) for k in keys)) if keys else np.zeros(0, np.float32)
        lang = conn.execute("select language from therapists t join sessions s on s.therapist_id = t.id where s.id = %s",
                            (sid,)).fetchone()["language"]
        segs, _ = asr.transcribe(samples, language=lang)
        text = " ".join(x.text for x in segs).strip()
        conn.execute("update sessions set dictation_text = %s, dictation_status = 'ready' where id = %s", (text, sid))
    except Exception:
        conn.execute("update sessions set dictation_status = 'failed' where id = %s", (sid,))
        raise
    finally:
        store().remove(keys)
        conn.execute("update audio_chunks set deleted_at = now() where session_id = %s and track = 'dictation'", (sid,))


# ── supervision_pack ─────────────────────────────────────────────────────────
def build_supervision_pack(conn: psycopg.Connection, job: dict, provider: LLMProvider) -> None:
    pack_id = job["payload"]["pack_id"]
    pack = conn.execute("select * from supervision_packs where id = %s", (pack_id,)).fetchone()
    if pack is None:
        return
    t = conn.execute("select language from therapists where id = %s", (pack["therapist_id"],)).fetchone()
    rows = conn.execute(
        """select c.pseudonym, s.started_at, n.content_json as note, r.content_json as reflection
             from sessions s join clients c on c.id = s.client_id
             join notes n on n.session_id = s.id and n.status = 'approved'
             left join reflections r on r.session_id = s.id
            where s.therapist_id = %s and s.started_at >= %s and s.started_at < (%s::date + interval '1 month')
            order by c.pseudonym, s.started_at""",
        (pack["therapist_id"], pack["month"], pack["month"]),
    ).fetchall()
    parts = []
    for r in rows:
        refl = r["reflection"] or {}
        points = [i["text"] for k in ("strengths", "missed_openings", "try_next") for i in refl.get(k, [])]
        parts.append(f"## {r['pseudonym']} — {r['started_at']:%d %b}\nNote:\n{_note_text(r['note'])}\n"
                     + ("Reflection points:\n- " + "\n- ".join(points) if points else ""))
    material = "\n\n".join(parts) if parts else "(No approved sessions this month.)"
    month_label = pack["month"].strftime("%B %Y")
    out = steps.supervision_pack(provider, month_label, t["language"], material)
    conn.execute(
        "update supervision_packs set content_json = content_json || %s, status = 'ready', prompt_version = %s, model_id = %s where id = %s",
        (db.Jsonb({"ai": out.model_dump()}), combined_version("supervision_pack"), provider.model_id(config.LLM_MODEL), pack_id),
    )
