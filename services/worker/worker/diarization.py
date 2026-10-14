"""Who spoke when.

Ported in spirit from the Clinical Lead's prototype: each stretch of speech gets
an ECAPA-TDNN voice fingerprint (SpeechBrain), fingerprints are grouped by
cosine similarity, and the therapist's enrolled voice ("calibration") anchors
the first group as "therapist".

Online calls record two tracks (mic = therapist, meeting tab = client), so the
track decides the speaker; fingerprints are used only to drop "bleed" — the
same words picked up on both tracks.

TODO(prototype): reconcile thresholds with psych_copilot once the source is in
reference/prototype/.
"""
from __future__ import annotations

from dataclasses import dataclass
from difflib import SequenceMatcher
from functools import lru_cache

import numpy as np

from . import config
from .asr import AsrSegment
from .audio import SAMPLE_RATE

SAME_SPEAKER = 0.45      # cosine similarity above which two fingerprints are the same person
THERAPIST_MATCH = 0.40   # similarity to the enrolled therapist voice needed to label "therapist"
MIN_EMBED_SECONDS = 0.8  # shorter speech is too little to fingerprint reliably
MAX_SPEAKERS = 4


@dataclass
class Labelled:
    start: float
    end: float
    text: str
    speaker: str


@lru_cache(maxsize=1)
def _encoder():
    from speechbrain.inference.speaker import EncoderClassifier

    return EncoderClassifier.from_hparams(
        source="speechbrain/spkrec-ecapa-voxceleb",
        savedir=str(config.MODELS_DIR / "ecapa"),
        run_opts={"device": "cpu"},
    )


def embed(samples: np.ndarray) -> np.ndarray:
    """Voice fingerprint (192 numbers, unit length) for a stretch of audio."""
    import torch

    with torch.no_grad():
        emb = _encoder().encode_batch(torch.from_numpy(samples.astype(np.float32)).unsqueeze(0))
    v = emb.squeeze().cpu().numpy().astype(np.float32)
    return v / (np.linalg.norm(v) + 1e-9)


def cosine(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / ((np.linalg.norm(a) * np.linalg.norm(b)) + 1e-9))


def _slice(samples: np.ndarray, start: float, end: float, max_seconds: float = 8.0) -> np.ndarray:
    # For long turns use the middle part — the start often overlaps the previous speaker.
    mid = (start + end) / 2
    half = min((end - start) / 2, max_seconds / 2)
    a, b = int((mid - half) * SAMPLE_RATE), int((mid + half) * SAMPLE_RATE)
    return samples[max(0, a) : max(0, b)]


def label_single_track(
    segments: list[AsrSegment],
    samples: np.ndarray,
    therapist_voice: np.ndarray | None,
    embed_fn=embed,
) -> list[Labelled]:
    """In-room or uploaded audio: one microphone, two or more voices."""
    if not segments:
        return []
    embs: list[np.ndarray | None] = []
    for s in segments:
        clip = _slice(samples, s.start, s.end)
        embs.append(embed_fn(clip) if len(clip) >= MIN_EMBED_SECONDS * SAMPLE_RATE else None)

    # Online clustering; the enrolled therapist voice is cluster 0 if we have it.
    centroids: list[np.ndarray] = []
    members: list[list[int]] = []
    anchored = therapist_voice is not None
    if anchored:
        centroids.append(therapist_voice / (np.linalg.norm(therapist_voice) + 1e-9))
        members.append([])
    assign: list[int | None] = []
    for i, e in enumerate(embs):
        if e is None:
            assign.append(None)
            continue
        sims = [cosine(e, c) for c in centroids]
        best = int(np.argmax(sims)) if sims else -1
        threshold = THERAPIST_MATCH if (anchored and best == 0) else SAME_SPEAKER
        if best >= 0 and sims[best] >= threshold:
            members[best].append(i)
            if not (anchored and best == 0):  # keep the enrolled voice fixed
                centroids[best] = _norm(np.mean([embs[j] for j in members[best]], axis=0))
            assign.append(best)
        elif len(centroids) < MAX_SPEAKERS:
            centroids.append(e)
            members.append([i])
            assign.append(len(centroids) - 1)
        else:
            assign.append(best)
            members[best].append(i)

    # Short turns ("Okay,", "Mm") inherit the label of the closest neighbour in time.
    known = [i for i, a in enumerate(assign) if a is not None]
    for i, a in enumerate(assign):
        if a is None:
            prev = next((j for j in reversed(known) if j < i), None)
            nxt = next((j for j in known if j > i), None)
            gap_prev = segments[i].start - segments[prev].end if prev is not None else float("inf")
            gap_next = segments[nxt].start - segments[i].end if nxt is not None else float("inf")
            pick = prev if gap_prev <= gap_next else nxt
            assign[i] = assign[pick] if pick is not None else 0

    # Name the clusters. Without an enrolled voice we assume the first person
    # to speak is the therapist (the therapist can swap labels in the app).
    therapist_cluster = 0 if anchored else assign[0]
    talk = {}
    for seg, a in zip(segments, assign):
        talk[a] = talk.get(a, 0.0) + (seg.end - seg.start)
    others = sorted((c for c in talk if c != therapist_cluster), key=lambda c: -talk[c])
    names = {therapist_cluster: "therapist"}
    for n, c in enumerate(others):
        names[c] = ["client", "client_2", "speaker_3", "speaker_4"][min(n, 3)]
    return [Labelled(s.start, s.end, s.text, names[a]) for s, a in zip(segments, assign)]


def _norm(v: np.ndarray) -> np.ndarray:
    return v / (np.linalg.norm(v) + 1e-9)


def _overlaps(a: AsrSegment, b: AsrSegment, slack: float = 1.0) -> bool:
    return a.start < b.end + slack and b.start < a.end + slack


def _similar_text(a: str, b: str) -> bool:
    return SequenceMatcher(None, a.lower(), b.lower()).ratio() >= 0.6


def label_two_tracks(mic: list[AsrSegment], tab: list[AsrSegment]) -> list[Labelled]:
    """Online call: mic = therapist, meeting tab = client. When the same words
    appear on both tracks at the same time (speaker bleed or echo), keep the copy
    on the louder/original side: words heard on the tab first are the client's."""
    out: list[Labelled] = []
    for m in mic:
        if any(_overlaps(m, t) and _similar_text(m.text, t.text) for t in tab):
            continue  # client's voice leaked into the therapist's microphone
        out.append(Labelled(m.start, m.end, m.text, "therapist"))
    for t in tab:
        out.append(Labelled(t.start, t.end, t.text, "client"))
    out.sort(key=lambda s: s.start)
    return out


def merge_turns(items: list[Labelled], max_gap: float = 0.8, max_chars: int = 400) -> list[Labelled]:
    """Joins consecutive pieces from the same speaker into readable turns, while
    keeping turns short enough to cite precisely."""
    merged: list[Labelled] = []
    for it in items:
        last = merged[-1] if merged else None
        if last and last.speaker == it.speaker and it.start - last.end <= max_gap and len(last.text) + len(it.text) < max_chars:
            merged[-1] = Labelled(last.start, max(last.end, it.end), f"{last.text} {it.text}".strip(), last.speaker)
        else:
            merged.append(it)
    return merged
