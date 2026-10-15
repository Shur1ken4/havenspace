"""Logging that never contains session content.

Only ids, counts, stages and error class names are ever logged. Never pass
transcript text, notes, quotes or pseudonyms to `log()`.
"""
from __future__ import annotations

import json
import sys
import time

_ALLOWED = {"job", "kind", "session", "stage", "count", "dropped", "seconds", "error", "attempt", "model", "items",
            "segments", "tracks", "language", "deleted", "provider", "term_hits", "bytes", "lines", "clips"}


def log(event: str, **fields: object) -> None:
    safe = {k: v for k, v in fields.items() if k in _ALLOWED}
    print(json.dumps({"t": round(time.time(), 1), "event": event, **safe}, default=str), file=sys.stderr, flush=True)
