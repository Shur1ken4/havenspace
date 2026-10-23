"""Speech-to-text with faster-whisper, running on our own machine (CPU locally,
GPU in production). Audio never leaves our infrastructure."""
from __future__ import annotations

import threading
from dataclasses import dataclass
from functools import lru_cache

import numpy as np

from . import config
from .log import log


@dataclass
class AsrSegment:
    start: float
    end: float
    text: str


_LOAD_LOCK = threading.Lock()  # the live thread and the job loop share one model


@lru_cache(maxsize=2)
def _load(name: str):
    from faster_whisper import WhisperModel

    return WhisperModel(
        name,
        device=config.WHISPER_DEVICE,
        compute_type=config.WHISPER_COMPUTE_TYPE,
        download_root=str(config.MODELS_DIR / "whisper"),
    )


def _model(name: str):
    with _LOAD_LOCK:
        return _load(name)


def transcribe(samples: np.ndarray, model_name: str | None = None, language: str | None = None,
               split_on_pauses: bool = False) -> tuple[list[AsrSegment], str | None]:
    """Returns segments and the detected language code. Silence is skipped (VAD).

    With split_on_pauses, segments are cut wherever there is a pause between
    words — Whisper's own segments can run across a change of speaker, which
    matters when several people share one microphone."""
    if samples.size < 1600:  # under 0.1 s
        return [], language
    if not split_on_pauses:
        return _transcribe(samples, model_name, language, False)
    try:
        return _transcribe(samples, model_name, language, True)
    except IndexError:
        # faster-whisper can fail to line up word timings on some audio (an edge case
        # inside the library); then keep Whisper's own segments rather than lose the session.
        log("asr.word_timestamps_failed")
        return _transcribe(samples, model_name, language, False)


def _transcribe(samples: np.ndarray, model_name: str | None, language: str | None,
                split_on_pauses: bool) -> tuple[list[AsrSegment], str | None]:
    model = _model(model_name or config.WHISPER_MODEL)
    segments, info = model.transcribe(
        samples,
        language=language,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500},
        beam_size=5,
        condition_on_previous_text=False,  # reduces repeated/hallucinated text on long audio
        word_timestamps=split_on_pauses,
    )
    if not split_on_pauses:
        out = [AsrSegment(s.start, s.end, s.text.strip()) for s in segments if s.text.strip()]
        return out, info.language
    out: list[AsrSegment] = []
    for seg in segments:
        words = list(seg.words or [])
        if not words:
            if seg.text.strip():
                out.append(AsrSegment(seg.start, seg.end, seg.text.strip()))
            continue
        current = [words[0]]
        for prev, w in zip(words, words[1:]):
            if w.start - prev.end >= PAUSE_SPLIT_SECONDS:
                out.append(_join(current))
                current = []
            current.append(w)
        out.append(_join(current))
    return [o for o in out if o.text], info.language


PAUSE_SPLIT_SECONDS = 0.35


def _join(words) -> AsrSegment:
    return AsrSegment(words[0].start, words[-1].end, "".join(w.word for w in words).strip())
