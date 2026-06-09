from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from pydantic import ValidationError

from app.services.intent import IntentClassification, classify_intent


def _mock_openai_response(content: str) -> MagicMock:
    response = MagicMock()
    response.choices = [MagicMock()]
    response.choices[0].message.content = content
    return response


def _mock_settings(*, api_key: str = "sk-test") -> MagicMock:
    return MagicMock(
        openai_api_key=api_key,
        intent_classifier_model="gpt-4.1-nano",
        intent_classifier_timeout_seconds=5,
    )


@pytest.mark.parametrize(
    "intent_value",
    ["greeting", "info_request", "advice_seeking", "distress", "out_of_scope"],
)
async def test_classify_intent_parses_each_intent(monkeypatch, intent_value: str) -> None:
    async def fake_create(**_kwargs):
        return _mock_openai_response(f'{{"intent": "{intent_value}"}}')

    mock_client = MagicMock()
    mock_client.chat.completions.create = fake_create
    monkeypatch.setattr("app.services.intent.get_openai_client", lambda: mock_client)
    monkeypatch.setattr("app.services.intent.get_settings", lambda: _mock_settings())

    result = await classify_intent("test question")

    assert result.intent == intent_value


async def test_classify_intent_fails_open_on_api_error(monkeypatch) -> None:
    async def fake_create(**_kwargs):
        raise RuntimeError("API down")

    mock_client = MagicMock()
    mock_client.chat.completions.create = fake_create
    monkeypatch.setattr("app.services.intent.get_openai_client", lambda: mock_client)
    monkeypatch.setattr("app.services.intent.get_settings", lambda: _mock_settings())

    result = await classify_intent("What trials are recruiting?")

    assert result.intent == "info_request"


async def test_classify_intent_fails_open_on_malformed_json(monkeypatch) -> None:
    async def fake_create(**_kwargs):
        return _mock_openai_response("not valid json")

    mock_client = MagicMock()
    mock_client.chat.completions.create = fake_create
    monkeypatch.setattr("app.services.intent.get_openai_client", lambda: mock_client)
    monkeypatch.setattr("app.services.intent.get_settings", lambda: _mock_settings())

    result = await classify_intent("hello")

    assert result.intent == "info_request"


async def test_classify_intent_fails_open_without_api_key(monkeypatch) -> None:
    monkeypatch.setattr("app.services.intent.get_settings", lambda: _mock_settings(api_key=""))

    result = await classify_intent("hello")

    assert result.intent == "info_request"


def test_intent_classification_rejects_invalid_intent() -> None:
    with pytest.raises(ValidationError):
        IntentClassification.model_validate({"intent": "unknown"})
