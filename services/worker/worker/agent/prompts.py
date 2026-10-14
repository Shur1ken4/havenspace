"""Loads versioned prompts from services/worker/prompts/*.md."""
from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

from .. import config


@dataclass(frozen=True)
class Prompt:
    name: str
    version: str
    body: str

    def render(self, **values: str) -> str:
        text = self.body
        for key, value in values.items():
            text = text.replace("{" + key + "}", value)
        return text


@lru_cache(maxsize=None)
def load(name: str) -> Prompt:
    raw = (config.PROMPTS_DIR / f"{name}.md").read_text()
    version = "unversioned"
    body = raw
    if raw.startswith("---"):
        _, front, body = raw.split("---", 2)
        for line in front.strip().splitlines():
            if line.startswith("version:"):
                version = line.split(":", 1)[1].strip()
    return Prompt(name, version, body.strip())


def combined_version(*names: str) -> str:
    return "+".join(f"{n}@{load(n).version}" for n in ("system", *names))
