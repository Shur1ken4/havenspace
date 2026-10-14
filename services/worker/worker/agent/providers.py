"""LLM providers behind one small interface.

- anthropic : Anthropic's API. Development with synthetic / role-play data ONLY.
- bedrock   : Claude on AWS Bedrock in an EU region. Required for real client data.
- demo      : no AI at all; the steps produce clearly-marked placeholder text.

When ALLOW_REAL_CLIENT_DATA=true, only `bedrock` is allowed (see ADR-3).
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, TypeVar

from pydantic import BaseModel, ValidationError

from .. import config
from ..log import log

T = TypeVar("T", bound=BaseModel)


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
        text = next((b.text for b in resp.content if b.type == "text"), "")
        return text, resp.stop_reason or ""


class Demo(LLMProvider):
    """No AI. Steps detect `is_demo` and build placeholder output themselves."""
    name = "demo"
    is_demo = True

    def model_id(self, model: str) -> str:
        return "demo"


def get_provider() -> LLMProvider:
    name = config.LLM_PROVIDER
    if config.ALLOW_REAL_CLIENT_DATA and name != "bedrock":
        raise RuntimeError("Real client data requires LLM_PROVIDER=bedrock (EU). See docs/decisions.md ADR-3.")
    if name == "anthropic":
        return AnthropicDirect()
    if name == "bedrock":
        return BedrockEU()
    return Demo()
