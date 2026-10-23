import numpy as np

from worker import asr


class _Seg:
    def __init__(self, start, end, text):
        self.start, self.end, self.text, self.words = start, end, text, None


class _Info:
    language = "en"


class _Model:
    """Fails like faster-whisper's word alignment does on some audio, works without word timings."""

    def transcribe(self, samples, word_timestamps=False, **_):
        if word_timestamps:
            def broken():
                raise IndexError("index out of bounds")
                yield
            return broken(), _Info()
        return iter([_Seg(0.0, 1.5, " Hello there. ")]), _Info()


def test_word_timing_failure_falls_back_to_whisper_segments(monkeypatch):
    monkeypatch.setattr(asr, "_model", lambda name: _Model())
    segs, lang = asr.transcribe(np.zeros(16000, np.float32), split_on_pauses=True)
    assert lang == "en"
    assert [(s.start, s.end, s.text) for s in segs] == [(0.0, 1.5, "Hello there.")]
