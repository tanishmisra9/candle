from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.services import rerank as rerank_module
from app.services.rerank import rerank_chunks, reset_cohere_client_cache
from app.services.retrieval import RetrievedChunk


def make_chunk(source_id: str, content: str) -> RetrievedChunk:
    return RetrievedChunk(
        source_type="trial",
        source_id=source_id,
        content=content,
        title=source_id,
        url=None,
        metadata={},
        distance=0.5,
    )


@pytest.fixture(autouse=True)
def clear_cohere_cache():
    reset_cohere_client_cache()
    yield
    reset_cohere_client_cache()


@pytest.mark.asyncio
async def test_rerank_passthrough_when_disabled(monkeypatch):
    monkeypatch.setattr(
        "app.services.rerank.get_settings",
        lambda: SimpleNamespace(rerank_enabled=False, cohere_api_key="key"),
    )
    chunks = [make_chunk(f"NCT{i}", f"content {i}") for i in range(10)]

    result = await rerank_chunks("query", chunks, top_n=6)

    assert result == chunks[:6]


@pytest.mark.asyncio
async def test_rerank_passthrough_when_no_api_key(monkeypatch):
    monkeypatch.setattr(
        "app.services.rerank.get_settings",
        lambda: SimpleNamespace(rerank_enabled=True, cohere_api_key=""),
    )
    chunks = [make_chunk(f"NCT{i}", f"content {i}") for i in range(8)]

    result = await rerank_chunks("query", chunks, top_n=6)

    assert result == chunks[:6]


@pytest.mark.asyncio
async def test_rerank_falls_back_on_api_failure(monkeypatch):
    monkeypatch.setattr(
        "app.services.rerank.get_settings",
        lambda: SimpleNamespace(
            rerank_enabled=True,
            cohere_api_key="key",
            rerank_model="rerank-v3.5",
            rerank_timeout_seconds=10,
            background_openai_max_retries=0,
            background_openai_retry_backoff_seconds=0,
        ),
    )

    async def fake_run_openai_operation(*_args, **_kwargs):
        raise RuntimeError("cohere down")

    monkeypatch.setattr(
        "app.services.rerank.run_openai_operation", fake_run_openai_operation
    )
    chunks = [make_chunk(f"NCT{i}", f"content {i}") for i in range(10)]

    result = await rerank_chunks("query", chunks, top_n=6)

    assert result == chunks[:6]


@pytest.mark.asyncio
async def test_rerank_reorders_by_relevance(monkeypatch):
    monkeypatch.setattr(
        "app.services.rerank.get_settings",
        lambda: SimpleNamespace(
            rerank_enabled=True,
            cohere_api_key="key",
            rerank_model="rerank-v3.5",
            rerank_timeout_seconds=10,
            background_openai_max_retries=0,
            background_openai_retry_backoff_seconds=0,
        ),
    )

    async def fake_run_openai_operation(operation, **_kwargs):
        return SimpleNamespace(
            results=[
                SimpleNamespace(index=2, relevance_score=0.9),
                SimpleNamespace(index=0, relevance_score=0.4),
            ]
        )

    monkeypatch.setattr(
        "app.services.rerank.run_openai_operation", fake_run_openai_operation
    )
    chunks = [make_chunk(f"NCT{i}", f"content {i}") for i in range(4)]

    result = await rerank_chunks("query", chunks, top_n=2)

    assert [chunk.source_id for chunk in result] == ["NCT2", "NCT0"]
    assert result[0].distance == pytest.approx(0.1)
    assert result[1].distance == pytest.approx(0.6)


@pytest.mark.asyncio
async def test_rerank_empty_input_returns_empty(monkeypatch):
    monkeypatch.setattr(
        "app.services.rerank.get_settings",
        lambda: SimpleNamespace(rerank_enabled=True, cohere_api_key="key"),
    )

    result = await rerank_chunks("query", [], top_n=6)

    assert result == []
