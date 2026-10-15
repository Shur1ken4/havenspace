"""Settings, read from the repo-root .env file and the environment."""
from __future__ import annotations

import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
WORKER_ROOT = Path(__file__).resolve().parents[1]


def _load_env() -> None:
    env = REPO_ROOT / ".env"
    if not env.exists():
        return
    for line in env.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_env()


def env(key: str, default: str = "") -> str:
    return os.environ.get(key, default)


DATABASE_URL = env("WORKER_DATABASE_URL")
ALLOW_REAL_CLIENT_DATA = env("ALLOW_REAL_CLIENT_DATA", "false").lower() == "true"
LLM_PROVIDER = env("LLM_PROVIDER", "demo")
LLM_MODEL = env("LLM_MODEL", "claude-opus-5-5")
LLM_MODEL_LIGHT = env("LLM_MODEL_LIGHT") or LLM_MODEL
WHISPER_MODEL = env("WHISPER_MODEL", "large-v3-turbo")
WHISPER_DEVICE = env("WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE_TYPE = env("WHISPER_COMPUTE_TYPE", "int8")
MODELS_DIR = Path(env("MODELS_DIR", str(REPO_ROOT / ".data" / "models")))
SHARED_DIR = REPO_ROOT / "packages" / "shared"
PROMPTS_DIR = WORKER_ROOT / "prompts"
FORBIDDEN_TERMS_FILE = REPO_ROOT / "evals" / "forbidden_terms.txt"

# Live research mode (ADR-10): experiment only, never with real client data.
LIVE_RESEARCH = env("LIVE_RESEARCH_EMAILS").strip() != "" and not ALLOW_REAL_CLIENT_DATA
LIVE_MODEL = env("LIVE_MODEL") or LLM_MODEL_LIGHT
LIVE_EVERY_SECONDS = int(env("LIVE_EVERY_SECONDS", "30"))
LIVE_WINDOW_SECONDS = int(env("LIVE_WINDOW_SECONDS", "240"))
LIVE_WHISPER_MODEL = env("LIVE_WHISPER_MODEL", "small")  # fast enough for real time on a laptop CPU
LIVE_CLIP_MS = 8000  # must match LIVE_CLIP_MS in apps/web recorder
