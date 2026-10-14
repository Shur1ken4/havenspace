from worker.agent import guardrails
from worker.agent.providers import strict_schema
from worker.schemas import ReflectionOut


def test_detects_risk_and_diagnosis_language():
    assert guardrails.hits("Overall risk level: low.")
    assert guardrails.hits("Presentation meets criteria for depression")
    assert guardrails.hits("Высокий риск")


def test_client_own_words_in_quotes_are_allowed():
    assert guardrails.hits('Client said "my GP said I am high risk".') == []


def test_clean_text_passes():
    assert guardrails.hits("Client described poor sleep and agreed to try a sleep diary.") == []


def test_strict_schema_closes_every_object():
    schema = strict_schema(ReflectionOut)

    def check(node):
        if isinstance(node, dict):
            assert "$ref" not in node
            if node.get("type") == "object":
                assert node["additionalProperties"] is False
                assert set(node["required"]) == set(node["properties"])
            for v in node.values():
                check(v)
        elif isinstance(node, list):
            for v in node:
                check(v)

    check(schema)
