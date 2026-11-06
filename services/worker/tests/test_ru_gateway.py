"""The Russian installation's AI connection: right request shape, no Claude, no foreign fallback, real-data gate."""
import pytest
from pydantic import BaseModel

from worker import config
from worker.agent import providers
from worker.agent.providers import InvalidOutputError, RefusalError, Request, RussianGateway, get_provider


class Out(BaseModel):
    text: str


def request(model="qwen/qwen3.6-35b"):
    return Request(system="sys", shared_context="transcript", instructions="do it", schema=Out, model=model)


def reply(content='{"text": "ok"}', finish="stop"):
    return {"model": "m", "usage": {"prompt_tokens": 1, "completion_tokens": 2},
            "choices": [{"finish_reason": finish, "message": {"content": content}}]}


@pytest.fixture()
def gateway(monkeypatch):
    settings = {"RU_LLM_BASE_URL": "https://gateway.test/v1/", "RU_LLM_API_KEY": "k", "RU_LLM_PROVIDERS": "Russian One, Russian Two"}
    monkeypatch.setattr(config, "env", lambda key, default="": settings.get(key, default))
    g = RussianGateway()
    g.sent = []
    g.replies = [reply()]
    monkeypatch.setattr(g, "_post", lambda body: (g.sent.append(body), g.replies.pop(0))[1])
    return g


def test_request_shape_and_no_foreign_fallback(gateway):
    assert gateway.structured(request()).text == "ok"
    body = gateway.sent[0]
    assert body["response_format"]["json_schema"]["strict"] is True
    assert body["provider"] == {"only": ["Russian One", "Russian Two"], "allow_fallbacks": False}
    assert "transcript" in body["messages"][1]["content"]


@pytest.mark.parametrize("model", ["claude-opus-5-5", "anthropic/claude-sonnet-5.5", "Anthropic/x"])
def test_refuses_claude(gateway, model):
    with pytest.raises(RuntimeError, match="must not use Claude"):
        gateway.structured(request(model))
    assert gateway.sent == []


def test_retries_once_on_bad_output_then_fails(gateway):
    gateway.replies = [reply("not json"), reply("still not")]
    with pytest.raises(InvalidOutputError):
        gateway.structured(request())
    assert len(gateway.sent) == 2


def test_content_filter_is_a_refusal(gateway):
    gateway.replies = [reply("", "content_filter")]
    with pytest.raises(RefusalError):
        gateway.structured(request())


@pytest.mark.parametrize("confirmed, allowed", [("false", False), ("true", True)])
def test_real_data_needs_a_confirmed_route(monkeypatch, confirmed, allowed):
    settings = {"RU_LLM_BASE_URL": "https://gateway.test/v1", "RU_LLM_API_KEY": "k", "RU_LLM_ROUTE_CONFIRMED": confirmed}
    monkeypatch.setattr(config, "env", lambda key, default="": settings.get(key, default))
    monkeypatch.setattr(config, "ALLOW_REAL_CLIENT_DATA", True)
    monkeypatch.setattr(config, "LLM_PROVIDER", "ru_gateway")
    if allowed:
        assert isinstance(get_provider(), providers.RussianGateway)
    else:
        with pytest.raises(RuntimeError, match="Real client data"):
            get_provider()


def test_anthropic_still_blocked_for_real_data(monkeypatch):
    monkeypatch.setattr(config, "ALLOW_REAL_CLIENT_DATA", True)
    monkeypatch.setattr(config, "LLM_PROVIDER", "anthropic")
    with pytest.raises(RuntimeError, match="Real client data"):
        get_provider()
