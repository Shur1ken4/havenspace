"""Positioning guardrail (ADR-4): AI text must not contain diagnosis or risk-scoring language."""
from __future__ import annotations

import re
from functools import lru_cache

from .. import config


@lru_cache(maxsize=1)
def forbidden_terms() -> tuple[str, ...]:
    lines = config.FORBIDDEN_TERMS_FILE.read_text(encoding="utf-8").splitlines()
    return tuple(l.strip().lower() for l in lines if l.strip() and not l.startswith("#"))


def _strip_quotes(text: str) -> str:
    # Words inside quotation marks are the client's own and may be recorded faithfully.
    return re.sub(r"[\"“«][^\"”»]*[\"”»]", " ", text)


def hits(text: str) -> list[str]:
    t = _strip_quotes(text).lower()
    return [term for term in forbidden_terms() if term in t]
