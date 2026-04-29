from types import SimpleNamespace

import pytest

from app.services.embeddings import embed_texts
from app.services.openai_executor import OpenAITimeoutError


@pytest.mark.asyncio
async def test_embed_texts_raises_timeout_when_openai_times_out(monkeypatch):
    monkeypatch.setattr("app.services.embeddings.settings.openai_api_key", "test-key")

    async def fake_run_openai_operation(*args, **kwargs):
        raise OpenAITimeoutError("OpenAI request timed out.")

    monkeypatch.setattr(
        "app.services.embeddings.run_openai_operation",
        fake_run_openai_operation,
    )

    with pytest.raises(OpenAITimeoutError, match="OpenAI request timed out."):
        await embed_texts(["trial chunk"])
