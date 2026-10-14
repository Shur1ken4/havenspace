"""Turns a synthetic eval session (evals/sessions/*.json) into role-play audio
using the Mac's built-in voices, for testing the worker end to end.

  uv run python tools/make_roleplay_audio.py evals/sessions/01-cbt-sleep-worry.json

Writes to .data/roleplay/<id>/: room.wav (one mic), mic.wav + tab.wav (online
call, one voice per track) and calibration.wav (therapist voice only).
Synthetic voices only — never real client audio.
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from worker.audio import SAMPLE_RATE, decode  # noqa: E402
from worker.config import REPO_ROOT  # noqa: E402

VOICES = {"therapist": "Moira", "client": "Daniel", "client_2": "Samantha"}
GAP = 0.7


def speak(text: str, voice: str) -> np.ndarray:
    with tempfile.NamedTemporaryFile(suffix=".aiff") as f:
        subprocess.run(["say", "-v", voice, "-o", f.name, text], check=True)
        return decode(Path(f.name).read_bytes())


def write_wav(path: Path, samples: np.ndarray) -> None:
    pcm = (np.clip(samples, -1, 1) * 32767).astype(np.int16)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SAMPLE_RATE)
        w.writeframes(pcm.tobytes())


def main(session_file: str) -> None:
    session = json.loads(Path(session_file).read_text())
    out = REPO_ROOT / ".data" / "roleplay" / session["id"]
    out.mkdir(parents=True, exist_ok=True)
    gap = np.zeros(int(GAP * SAMPLE_RATE), np.float32)
    room, mic, tab = [], [], []
    for seg in session["segments"]:
        clip = speak(seg["text"], VOICES.get(seg["speaker"], "Samantha"))
        silence = np.zeros_like(clip)
        room += [clip, gap]
        if seg["speaker"] == "therapist":
            mic += [clip, gap]
            # A little "bleed": the other side hears a faint, delayed echo of nothing — keep tab silent.
            tab += [silence, gap]
        else:
            tab += [clip, gap]
            mic += [silence, gap]
    write_wav(out / "room.wav", np.concatenate(room))
    write_wav(out / "mic.wav", np.concatenate(mic))
    write_wav(out / "tab.wav", np.concatenate(tab))
    write_wav(out / "calibration.wav", speak("I'm here to listen. Take your time, there's no right or wrong way to begin.", VOICES["therapist"]))
    print(out)


if __name__ == "__main__":
    main(sys.argv[1])
