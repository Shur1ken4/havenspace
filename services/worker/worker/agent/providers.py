"""LLM providers behind one small interface.

- anthropic : Anthropic's API. Development with synthetic / role-play data ONLY.
- bedrock   : Claude on AWS Bedrock in an EU region. Required for real client data.
- ru_gateway: an OpenAI-style gateway (Polza, Yandex) for the Russian installation (ADR-23). Never Claude.
- demo      : no AI at all; the steps produce clearly-marked placeholder text.

When ALLOW_REAL_CLIENT_DATA=true, only `bedrock` is allowed (see ADR-3), or `ru_gateway`
on the Russian installation once its route is confirmed to stay in Russia.
"""
from __future__ import annotations

import json
import urllib.request
from contextvars import ContextVar
from dataclasses import dataclass
from types import SimpleNamespace
from typing import Any, TypeVar

from pydantic import BaseModel, ValidationError

from .. import config
from ..log import log

T = TypeVar("T", bound=BaseModel)

# Who this thread's AI calls are recorded against: (connection, therapist, session).
_usage_owner: ContextVar[tuple | None] = ContextVar("usage_owner", default=None)


def charge_usage_to(conn: Any, therapist_id: str, session_id: Any = None) -> None:
    """Call before a job's AI steps. Evals never call it, so they record nothing."""
    _usage_owner.set((conn, therapist_id, session_id))


class RefusalError(RuntimeError):
    pass


class InvalidOutputError(RuntimeError):
    pass


def strict_schema(model: type[BaseModel]) -> dict[str, Any]:
    """Pydantic JSON schema → the subset accepted by structured outputs:
    every object closed and fully required; validation-only keywords removed
    (Pydantic re-checks them afterwards)."""
    schema = model.model_json_schema()
    defs = schema.pop("$defs", {})

    def fix(node: Any) -> Any:
        if isinstance(node, dict):
            if "$ref" in node:
                return fix(defs[node["$ref"].split("/")[-1]])
            node = {k: fix(v) for k, v in node.items()
                    if k not in {"title", "default", "minimum", "maximum", "minLength", "maxLength", "minItems", "maxItems"}}
            if node.get("type") == "object":
                node["additionalProperties"] = False
                node["required"] = list(node.get("properties", {}).keys())
            return node
        if isinstance(node, list):
            return [fix(v) for v in node]
        return node

    return fix(schema)


@dataclass
class Request:
    system: str
    shared_context: str      # the transcript etc. — identical across steps, so it is cached
    instructions: str        # step-specific instructions
    schema: type[BaseModel]
    model: str
    effort: str = "medium"
    max_tokens: int = 16000
    step: str = "other"      # the name recorded in llm_usage


class LLMProvider:
    name = "base"
    is_demo = False

    def model_id(self, model: str) -> str:
        return model

    def _call(self, req: Request, extra_user: str | None) -> tuple[str, str]:
        raise NotImplementedError

    def structured(self, req: Request) -> BaseModel:
        """Calls the model and validates the reply; retries once if invalid."""
        feedback = None
        for attempt in (1, 2):
            text, stop = self._call(req, feedback)
            if stop == "refusal":
                raise RefusalError("model declined")
            try:
                return req.schema.model_validate(json.loads(text))
            except (json.JSONDecodeError, ValidationError) as err:
                log("llm.invalid_output", attempt=attempt, error=type(err).__name__)
                feedback = ("Your previous reply did not match the required format "
                            f"({type(err).__name__}). Reply again, following the schema exactly.")
        raise InvalidOutputError("invalid output after retry")

    def _record_usage(self, req: Request, resp: Any) -> None:
        """Saves token counts only, never content. A failure here must not stop a session."""
        owner = _usage_owner.get()
        if owner is None:
            return
        conn, therapist_id, session_id = owner
        u = resp.usage
        try:
            conn.execute(
                """insert into llm_usage (therapist_id, session_id, step, provider, model_id, input_tokens, output_tokens,
                                          cache_write_tokens, cache_read_tokens)
                   values (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (therapist_id, session_id, req.step, self.name, resp.model, u.input_tokens, u.output_tokens,
                 getattr(u, "cache_creation_input_tokens", 0) or 0, getattr(u, "cache_read_input_tokens", 0) or 0),
            )
        except Exception as err:  # noqa: BLE001
            log("llm.usage_not_saved", error=type(err).__name__)

    def _messages(self, req: Request, extra_user: str | None) -> list[dict[str, Any]]:
        content: list[dict[str, Any]] = [
            {"type": "text", "text": req.shared_context, "cache_control": {"type": "ephemeral"}},
            {"type": "text", "text": req.instructions},
        ]
        if extra_user:
            content.append({"type": "text", "text": extra_user})
        return [{"role": "user", "content": content}]


class AnthropicDirect(LLMProvider):
    name = "anthropic"

    def __init__(self) -> None:
        import anthropic

        self.client = anthropic.Anthropic()

    def _call(self, req: Request, extra_user: str | None) -> tuple[str, str]:
        # Refusal fallbacks: if a safety classifier declines, the API re-runs the
        # request on Anthropic's recommended fallback model inside the same call.
        resp = self.client.beta.messages.create(
            model=req.model,
            max_tokens=req.max_tokens,
            system=req.system,
            messages=self._messages(req, extra_user),
            output_config={"effort": req.effort, "format": {"type": "json_schema", "schema": strict_schema(req.schema)}},
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        )
        self._record_usage(req, resp)
        text = next((b.text for b in resp.content if b.type == "text"), "")
        return text, resp.stop_reason or ""


class BedrockEU(LLMProvider):
    name = "bedrock"

    def __init__(self) -> None:
        import anthropic

        region = config.env("AWS_REGION", "eu-central-1")
        if not region.startswith("eu-"):
            raise RuntimeError("Bedrock must run in an EU region")
        self.client = anthropic.AnthropicBedrockMantle(aws_region=region)

    def model_id(self, model: str) -> str:
        return config.env("BEDROCK_MODEL_ID") or f"anthropic.{model}"

    def _call(self, req: Request, extra_user: str | None) -> tuple[str, str]:
        resp = self.client.messages.create(
            model=self.model_id(req.model),
            max_tokens=req.max_tokens,
            system=req.system,
            messages=self._messages(req, extra_user),
            output_config={"effort": req.effort, "format": {"type": "json_schema", "schema": strict_schema(req.schema)}},
        )
        self._record_usage(req, resp)
        text = next((b.text for b in resp.content if b.type == "text"), "")
        return text, resp.stop_reason or ""


class RussianGateway(LLMProvider):
    """The Russian installation's AI. Anthropic's policy excludes Russia, resellers included, so Claude is refused."""
    name = "ru_gateway"

    def __init__(self) -> None:
        self.base_url = config.env("RU_LLM_BASE_URL").rstrip("/")
        self.api_key = config.env("RU_LLM_API_KEY")
        if not self.base_url or not self.api_key:
            raise RuntimeError("ru_gateway needs RU_LLM_BASE_URL and RU_LLM_API_KEY")
        # Polza only: the providers allowed to serve a request. Yandex directly needs none.
        self.providers = [p.strip() for p in config.env("RU_LLM_PROVIDERS").split(",") if p.strip()]

    def _post(self, body: dict[str, Any]) -> dict[str, Any]:
        request = urllib.request.Request(
            f"{self.base_url}/chat/completions", data=json.dumps(body).encode(),
            headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"})
        with urllib.request.urlopen(request, timeout=600) as resp:
            return json.loads(resp.read())

    def _call(self, req: Request, extra_user: str | None) -> tuple[str, str]:
        if "claude" in req.model.lower() or req.model.lower().startswith("anthropic/"):
            raise RuntimeError("ru_gateway must not use Claude; set LLM_MODEL (ADR-23)")
        parts = [req.shared_context, req.instructions] + ([extra_user] if extra_user else [])
        body: dict[str, Any] = {
            "model": req.model,
            "max_tokens": req.max_tokens,
            "messages": [{"role": "system", "content": req.system}, {"role": "user", "content": "\n\n".join(parts)}],
            "response_format": {"type": "json_schema", "json_schema": {
                "name": req.schema.__name__, "strict": True, "schema": strict_schema(req.schema)}},
        }
        if self.providers:
            body["provider"] = {"only": self.providers, "allow_fallbacks": False}
        data = self._post(body)
        u = data.get("usage") or {}
        self._record_usage(req, SimpleNamespace(model=data.get("model", req.model), usage=SimpleNamespace(
            input_tokens=u.get("prompt_tokens", 0), output_tokens=u.get("completion_tokens", 0),
            cache_read_input_tokens=(u.get("prompt_tokens_details") or {}).get("cached_tokens", 0))))
        choice = data["choices"][0]
        stop = "refusal" if choice.get("finish_reason") == "content_filter" else choice.get("finish_reason", "")
        return choice["message"].get("content") or "", stop


class Demo(LLMProvider):
    """No AI. Steps detect `is_demo` and build placeholder output themselves."""
    name = "demo"
    is_demo = True

    def model_id(self, model: str) -> str:
        return "demo"


def get_provider() -> LLMProvider:
    name = config.LLM_PROVIDER
    if config.ALLOW_REAL_CLIENT_DATA:
        confirmed = name == "ru_gateway" and config.env("RU_LLM_ROUTE_CONFIRMED").lower() == "true"
        if name != "bedrock" and not confirmed:
            raise RuntimeError("Real client data requires LLM_PROVIDER=bedrock (EU), or ru_gateway with its route "
                               "confirmed on the Russian installation. See docs/decisions.md ADR-3 and ADR-23.")
    if name == "anthropic":
        return AnthropicDirect()
    if name == "bedrock":
        return BedrockEU()
    if name == "ru_gateway":
        return RussianGateway()
    return Demo()
