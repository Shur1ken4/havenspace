# Clinical Lead's prototype (read-only)

Put the contents of `psych_copilot.zip` here. This folder is ignored by git
except for this README, so the prototype is never published by accident.

What has been ported (see `services/worker/worker/diarization.py`):
- ECAPA-TDNN voice fingerprints (SpeechBrain `spkrec-ecapa-voxceleb`)
- clustering by cosine similarity
- therapist voice calibration so the therapist is always labelled correctly

Not ported, on purpose (docs/decisions.md ADR-4): the live-advice loop and the
crisis/risk marker.

TODO once the source is here: compare thresholds (`SAME_SPEAKER`,
`THERAPIST_MATCH`) and the bleed handling with the prototype's values.
