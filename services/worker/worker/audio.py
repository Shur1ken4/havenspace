"""Decoding recorded audio into 16 kHz mono samples (PyAV bundles FFmpeg, so
no system install is needed)."""
from __future__ import annotations

import io

import av
import numpy as np

SAMPLE_RATE = 16_000


def decode(data: bytes) -> np.ndarray:
    """Any browser/upload format → float32 mono at 16 kHz. Tolerates a truncated
    final piece (e.g. a tab that crashed mid-recording)."""
    out: list[np.ndarray] = []
    with av.open(io.BytesIO(data), mode="r") as container:
        stream = next((s for s in container.streams if s.type == "audio"), None)
        if stream is None:
            return np.zeros(0, dtype=np.float32)
        resampler = av.AudioResampler(format="flt", layout="mono", rate=SAMPLE_RATE)
        try:
            for frame in container.decode(stream):
                for res in resampler.resample(frame):
                    out.append(res.to_ndarray().reshape(-1))
        except (av.error.InvalidDataError, av.error.EOFError):
            pass  # keep everything decoded before the damaged tail
        for res in resampler.resample(None):
            out.append(res.to_ndarray().reshape(-1))
    if not out:
        return np.zeros(0, dtype=np.float32)
    return np.concatenate(out).astype(np.float32)


def seconds(samples: np.ndarray) -> float:
    return len(samples) / SAMPLE_RATE
