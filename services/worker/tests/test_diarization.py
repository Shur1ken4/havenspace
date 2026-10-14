import numpy as np

from worker.asr import AsrSegment
from worker.audio import SAMPLE_RATE
from worker.diarization import Labelled, label_single_track, label_two_tracks, merge_turns

A = np.array([1.0, 0.0, 0.0])
B = np.array([0.0, 1.0, 0.0])


def fake_embed_factory(voices):
    """Returns the voice vector for whichever segment the clip came from."""
    def embed(clip):
        return voices[int(round(clip[0]))]
    return embed


def make_audio(segments, voice_ids):
    total = int((segments[-1].end + 1) * SAMPLE_RATE)
    audio = np.zeros(total, np.float32)
    for seg, vid in zip(segments, voice_ids):
        audio[int(seg.start * SAMPLE_RATE): int(seg.end * SAMPLE_RATE)] = vid
    return audio


def test_enrolled_voice_is_labelled_therapist_even_if_client_speaks_first():
    segs = [AsrSegment(0, 2, "client first"), AsrSegment(2.5, 4.5, "therapist"), AsrSegment(5, 7, "client again")]
    audio = make_audio(segs, [1, 0, 1])
    out = label_single_track(segs, audio, therapist_voice=A, embed_fn=fake_embed_factory({0: A, 1: B}))
    assert [o.speaker for o in out] == ["client", "therapist", "client"]


def test_without_enrolment_first_speaker_is_assumed_therapist():
    segs = [AsrSegment(0, 2, "a"), AsrSegment(2.5, 4.5, "b"), AsrSegment(5, 7, "a2")]
    audio = make_audio(segs, [0, 1, 0])
    out = label_single_track(segs, audio, therapist_voice=None, embed_fn=fake_embed_factory({0: A, 1: B}))
    assert [o.speaker for o in out] == ["therapist", "client", "therapist"]


def test_short_word_takes_closest_neighbour():
    segs = [AsrSegment(0, 2, "long therapist turn"), AsrSegment(4.0, 4.3, "Okay,"), AsrSegment(4.4, 7, "client turn")]
    audio = make_audio(segs, [0, 1, 1])
    out = label_single_track(segs, audio, therapist_voice=A, embed_fn=fake_embed_factory({0: A, 1: B}))
    assert out[1].speaker == "client"


def test_two_tracks_drop_bleed_from_microphone():
    mic = [AsrSegment(0, 2, "How was your week?"), AsrSegment(3, 5, "It was hard, I didn't sleep")]  # second is bleed
    tab = [AsrSegment(3.1, 5.1, "It was hard, I didn't sleep.")]
    out = label_two_tracks(mic, tab)
    assert [(o.speaker, o.text) for o in out] == [("therapist", "How was your week?"), ("client", "It was hard, I didn't sleep.")]


def test_merge_joins_same_speaker_pieces():
    items = [Labelled(0, 1, "Hello", "therapist"), Labelled(1.2, 2, "there.", "therapist"), Labelled(2.5, 3, "Hi.", "client")]
    merged = merge_turns(items)
    assert [m.text for m in merged] == ["Hello there.", "Hi."]
