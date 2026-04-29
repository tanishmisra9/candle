from types import SimpleNamespace

import pytest

from app.services.embeddings import embed_texts, get_openai_client, reset_openai_client_cache
from app.services.openai_executor import OpenAITimeoutError


@pytest.fixture(autouse=True)
def clear_openai_client_cache():
    reset_openai_client_cache()
    yield
    reset_openai_client_cache()


@pytest.mark.asyncio
async def test_embed_texts_raises_timeout_when_openai_times_out(monkeypatch):
    monkeypatch.setattr(
        "app.services.embeddings.get_settings",
        lambda: SimpleNamespace(
            openai_api_key="test-key",
            embedding_model="text-embedding-3-small",
            embedding_timeout_seconds=20,
            background_openai_max_retries=2,
            background_openai_retry_backoff_seconds=0.5,
        ),
    )

    async def fake_run_openai_operation(*args, **kwargs):
        raise OpenAITimeoutError("OpenAI request timed out.")

    monkeypatch.setattr(
        "app.services.embeddings.run_openai_operation",
        fake_run_openai_operation,
    )

    with pytest.raises(OpenAITimeoutError, match="OpenAI request timed out."):
        await embed_texts(["trial chunk"])


@pytest.mark.asyncio
async def test_embed_texts_retries_transient_failures(monkeypatch):
    monkeypatch.setattr(
        "app.services.embeddings.get_settings",
        lambda: SimpleNamespace(
            openai_api_key="test-key",
            embedding_model="text-embedding-3-small",
            embedding_timeout_seconds=20,
            background_openai_max_retries=2,
            background_openai_retry_backoff_seconds=0,
        ),
    )

    calls = {"count": 0}

    class FakeEmbeddingsClient:
        async def create(self, *, model, input):
            calls["count"] += 1
            if calls["count"] == 1:
                raise RuntimeError("temporary failure")
            return SimpleNamespace(
                data=[SimpleNamespace(embedding=[0.1, 0.2, 0.3]) for _ in input]
            )

    class FakeOpenAIClient:
        def __init__(self):
            self.embeddings = FakeEmbeddingsClient()

    monkeypatch.setattr(
        "app.services.embeddings.get_openai_client",
        lambda api_key=None: FakeOpenAIClient(),
    )

    vectors = await embed_texts(["trial chunk"])

    assert calls["count"] == 2
    assert vectors == [[0.1, 0.2, 0.3]]


def test_get_openai_client_is_keyed_by_api_key(monkeypatch):
    created_keys = []

    class FakeAsyncOpenAI:
        def __init__(self, *, api_key):
            created_keys.append(api_key)
            self.api_key = api_key

    monkeypatch.setattr("app.services.embeddings.AsyncOpenAI", FakeAsyncOpenAI)

    first = get_openai_client("key-one")
    again = get_openai_client("key-one")
    second = get_openai_client("key-two")

    assert first is again
    assert first is not second
    assert created_keys == ["key-one", "key-two"]
