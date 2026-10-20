"""Live research mode (ADR-10): an EXPERIMENT for the founders, role-play only.

While a session with `live_research` is recording, the browser sends short,
self-contained ~8 s clips (tracks live_mic / live_tab / live_room) next to the
normal recording. This loop, running in its own thread:

1. transcribes each clip as soon as it arrives and deletes it straight away,
2. stores the words in live_lines (mic = therapist, tab = client; in the room
   the therapist's enrolled voice decides),
3. every LIVE_EVERY_SECONDS asks the AI for a short read of the last few
   minutes and stores it in live_insights, which the recording screen shows.

The normal after-session pipeline is unchanged and ignores these clips.
"""
from __future__ import annotations

import re
import threading
import time
from difflib import SequenceMatcher

import numpy as np
import psycopg

from . import asr, audio, config, db, diarization
from .agent import guardrails
from .agent.prompts import load
from .agent.providers import LLMProvider, Request
from .agent.steps import LANGUAGE_NAMES
from .log import log
from .pipeline import _pack
from .schemas import LiveInsightOut
from .storage import store

POLL_SECONDS = 1.0
MIN_NEW_LINES = 2


class LiveRunner(threading.Thread):
    def __init__(self, provider: LLMProvider, stop: threading.Event) -> None:
        super().__init__(name="live", daemon=True)
        self.provider = provider
        self.stop_event = stop
        self.voices: dict[str, np.ndarray | None] = {}   # session -> therapist voice (or None)
        self.languages: dict[str, str] = {}              # session -> detected language

    def run(self) -> None:
        conn = db.connect()
        log("live.start", provider=self.provider.name, model=config.LIVE_MODEL)
        while not self.stop_event.is_set():
            try:
                if conn.closed:
                    conn = db.connect()
                worked = self.transcribe_clips(conn) + self.write_insights(conn)
            except psycopg.OperationalError:
                # The database dropped the connection (e.g. a hosted database paused):
                # reconnect after a short wait instead of failing every second.
                log("live.reconnect")
                self.stop_event.wait(5)
                try:
                    conn.close()
                    conn = db.connect()
                except psycopg.OperationalError:
                    pass
                continue
            except Exception as err:  # noqa: BLE001 — class name only, never content
                log("live.error", error=type(err).__name__)
                worked = 0
            if not worked:
                self.stop_event.wait(POLL_SECONDS)
        conn.close()

    # ── 1–2. clips → lines ───────────────────────────────────────────────────
    def transcribe_clips(self, conn: psycopg.Connection) -> int:
        with db.transaction(conn) as cur:
            # Taking a clip marks it deleted at once, so no other worker picks it up.
            cur.execute(
                """update audio_chunks a set deleted_at = now()
                    where a.id in (select id from audio_chunks where track like 'live\\_%%' and deleted_at is null
                                    order by created_at limit 4 for update skip locked)
                returning a.id, a.therapist_id, a.session_id, a.track, a.seq, a.path"""
            )
            clips = cur.fetchall()
        for clip in clips:
            try:
                s = conn.execute("select status, live_research from sessions where id = %s", (clip["session_id"],)).fetchone()
                if s and s["live_research"] and s["status"] in ("draft", "recording"):
                    self._transcribe(conn, clip)
            finally:
                store().remove([clip["path"]])
        if clips:
            log("live.clips", clips=len(clips))
        return len(clips)

    def _transcribe(self, conn: psycopg.Connection, clip: dict) -> None:
        sid = clip["session_id"]
        samples = audio.decode(store().get(clip["path"]))
        room = clip["track"] == "live_room"
        segs, lang = asr.transcribe(samples, model_name=config.LIVE_WHISPER_MODEL, language=self.languages.get(sid),
                                   split_on_pauses=room)
        if lang and sid not in self.languages and segs:
            self.languages[sid] = lang
        if not segs:
            return
        if room:
            speakers = self._room_speakers(conn, sid, segs, samples)
        else:
            speakers = ["therapist" if clip["track"] == "live_mic" else "client"] * len(segs)
        base = clip["seq"] * config.LIVE_CLIP_MS
        for seg, speaker in zip(segs, speakers):
            if speaker == "therapist" and not room and self._is_bleed(conn, sid, clip["seq"], seg.text):
                continue
            conn.execute(
                "insert into live_lines (therapist_id, session_id, seq, speaker, offset_ms, text) values (%s,%s,%s,%s,%s,%s)",
                (clip["therapist_id"], sid, clip["seq"], speaker, base + int(seg.start * 1000), seg.text),
            )
        if clip["track"] == "live_tab":
            # The client's words may also have leaked into the therapist's mic.
            for row in conn.execute("select id, text from live_lines where session_id = %s and speaker = 'therapist' "
                                    "and seq between %s and %s", (sid, clip["seq"] - 1, clip["seq"] + 1)).fetchall():
                if any(_similar(row["text"], s.text) for s in segs):
                    conn.execute("delete from live_lines where id = %s", (row["id"],))

    def _is_bleed(self, conn: psycopg.Connection, sid: str, seq: int, text: str) -> bool:
        rows = conn.execute("select text from live_lines where session_id = %s and speaker = 'client' and seq between %s and %s",
                            (sid, seq - 1, seq + 1)).fetchall()
        return any(_similar(r["text"], text) for r in rows)

    def _room_speakers(self, conn: psycopg.Connection, sid: str, segs: list[asr.AsrSegment], samples: np.ndarray) -> list[str]:
        if sid not in self.voices:
            self.voices[sid] = self._therapist_voice(conn, sid)
        voice = self.voices[sid]
        if voice is None:
            return ["speaker"] * len(segs)
        out: list[str | None] = []
        for seg in segs:
            clip = samples[int(seg.start * audio.SAMPLE_RATE): int(seg.end * audio.SAMPLE_RATE)]
            if len(clip) < diarization.MIN_EMBED_SECONDS * audio.SAMPLE_RATE:
                out.append(None)
                continue
            sim = diarization.cosine(diarization.embed(clip), voice)
            out.append("therapist" if sim >= diarization.THERAPIST_MATCH else "client")
        last = conn.execute("select speaker from live_lines where session_id = %s order by id desc limit 1", (sid,)).fetchone()
        prev = last["speaker"] if last else "therapist"
        labels = []
        for o in out:  # very short words ("Mm", "Okay") take the previous label
            prev = o or prev
            labels.append(prev)
        return labels

    def _therapist_voice(self, conn: psycopg.Connection, sid: str) -> np.ndarray | None:
        rows = conn.execute("select path from audio_chunks where session_id = %s and track = 'calibration' "
                            "and deleted_at is null order by seq", (sid,)).fetchall()
        if rows:
            try:
                samples = audio.decode(b"".join(store().get(r["path"]) for r in rows))
                if audio.seconds(samples) >= 1.5:
                    return diarization.embed(samples)
            except Exception:  # noqa: BLE001 — fall back to the saved voice
                pass
        row = conn.execute("select t.voice_embedding from sessions s join therapists t on t.id = s.therapist_id "
                           "where s.id = %s", (sid,)).fetchone()
        if row and row["voice_embedding"]:
            return np.array(row["voice_embedding"], dtype=np.float32)
        return None

    # ── 3. lines → insight ───────────────────────────────────────────────────
    def write_insights(self, conn: psycopg.Connection) -> int:
        due = conn.execute(
            """select s.id, s.therapist_id, t.language, t.modalities,
                      (select max(id) from live_lines l where l.session_id = s.id) as last_line,
                      (select max(upto_line) from live_insights i where i.session_id = s.id) as seen_line,
                      (select max(created_at) from live_insights i where i.session_id = s.id) as last_at
                 from sessions s join therapists t on t.id = s.therapist_id
                where s.live_research and s.status in ('draft', 'recording')"""
        ).fetchall()
        done = 0
        for s in due:
            if s["last_line"] is None:
                continue
            new = conn.execute("select count(*) as n from live_lines where session_id = %s and id > %s",
                               (s["id"], s["seen_line"] or 0)).fetchone()["n"]
            waited = s["last_at"] is None or (time.time() - s["last_at"].timestamp()) >= config.LIVE_EVERY_SECONDS
            if new >= MIN_NEW_LINES and waited:
                self._insight(conn, s)
                done += 1
        # Forget sessions that have ended.
        active = {s["id"] for s in due}
        for d in (self.voices, self.languages):
            for sid in list(d):
                if sid not in active:
                    d.pop(sid, None)
        return done

    def _insight(self, conn: psycopg.Connection, s: dict) -> None:
        sid = s["id"]
        lines = conn.execute("select id, speaker, offset_ms, text from live_lines where session_id = %s order by offset_ms, id",
                             (sid,)).fetchall()
        end_ms = max(l["offset_ms"] for l in lines)
        window = [l for l in lines if l["offset_ms"] >= end_ms - config.LIVE_WINDOW_SECONDS * 1000]
        previous = conn.execute("select content from live_insights where session_id = %s order by id desc limit 3",
                                (sid,)).fetchall()
        language = s["language"] if s["language"] in LANGUAGE_NAMES else "en"
        modality = _pack((s["modalities"] or ["general"])[0]).get("name", "an integrative approach")
        started = time.time()
        if self.provider.is_demo:
            out = _demo(window, language)
        else:
            prompt = load("live_insight")
            prev_text = "\n".join(f"- {p['content'].get('now', '')} | openings: "
                                  + "; ".join(o["point"] for o in p["content"].get("openings", []))
                                  for p in previous) or "(none yet)"
            out = self.provider.structured(Request(
                system=prompt.render(modality=modality, language=LANGUAGE_NAMES[language], previous=prev_text),
                shared_context="Last minutes of the session so far:\n" + "\n".join(
                    f"({_clock(l['offset_ms'])}) {_label(l['speaker'])}: {l['text']}" for l in window),
                instructions="Write your read now.",
                schema=LiveInsightOut,
                model=config.LIVE_MODEL,
                effort="low",
                max_tokens=1500,
            ))
        content = _checked(out, window)
        if content is None:
            log("live.insight_dropped", session=sid)
            return
        conn.execute(
            """insert into live_insights (therapist_id, session_id, upto_line, offset_ms, content, model_id, prompt_version)
               values (%s, %s, %s, %s, %s, %s, %s)""",
            (s["therapist_id"], sid, s["last_line"], end_ms, db.Jsonb(content),
             self.provider.model_id(config.LIVE_MODEL), "live_insight@" + load("live_insight").version),
        )
        log("live.insight", session=sid, lines=len(window), seconds=round(time.time() - started, 1))


def _checked(out: LiveInsightOut, window: list[dict]) -> dict | None:
    """Evidence and guardrail checks, as for the after-session reflection:
    openings must quote the client's real words; diagnosis/risk language is dropped."""
    if guardrails.hits(out.now):
        return None
    client_text = _norm(" ".join(l["text"] for l in window if l["speaker"] in ("client", "speaker")))
    openings = [o.model_dump() for o in out.openings[:2]
                if _norm(o.quote) and _norm(o.quote) in client_text and not guardrails.hits(o.point)]
    idea = "" if guardrails.hits(out.idea) else out.idea
    return {"now": out.now, "openings": openings, "idea": idea}


def _demo(window: list[dict], language: str) -> LiveInsightOut:
    from .schemas import LiveOpening

    last_client = next((l for l in reversed(window) if l["speaker"] in ("client", "speaker")), None)
    quote = " ".join(last_client["text"].split()[:8]) if last_client else ""
    ru = language == "ru"
    return LiveInsightOut(
        now=("[Демо] Здесь появится краткое описание того, что происходит в разговоре." if ru
             else "[Demo] A short read of what is happening in the conversation will appear here."),
        openings=[LiveOpening(point="[Демо] Возможная тема для исследования" if ru else "[Demo] Something you might explore",
                              quote=quote)] if quote else [],
        idea="[Демо] Подключите ключ ИИ, чтобы видеть настоящие подсказки." if ru
             else "[Demo] Connect an AI key to see real suggestions.",
    )


def _similar(a: str, b: str) -> bool:
    return SequenceMatcher(None, a.lower(), b.lower()).ratio() >= 0.6


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", " ", text.lower())).strip()


def _clock(ms: int) -> str:
    s = ms // 1000
    return f"{s // 60:02d}:{s % 60:02d}"


def _label(speaker: str) -> str:
    return {"therapist": "Therapist", "client": "Client"}.get(speaker, "Speaker")
