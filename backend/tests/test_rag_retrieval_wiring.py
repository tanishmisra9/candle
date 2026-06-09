from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.services.rag import _prepare_question_context


class _FakeSession:
    async def scalars(self, *_args, **_kwargs):
        class _Empty:
            def all(self):
                return []

        return _Empty()


@pytest.mark.asyncio
async def test_prepare_question_context_embeds_raw_question_and_bm25_uses_expanded(
    monkeypatch,
):
    captured: dict[str, object] = {}

    async def fake_embed_query(text: str) -> list[float]:
        captured["embed_text"] = text
        return [0.0] * 3072

    async def fake_retrieve_hybrid_chunks(
        _session, query, _embedding, limit=50, source_type=None
    ):
        captured["hybrid_query"] = query
        captured["hybrid_limit"] = limit
        return []

    async def fake_rerank_chunks(_query, chunks, top_n):
        return chunks[:top_n]

    async def fake_filter_non_chm_trial_chunks(_session, chunks):
        return chunks

    monkeypatch.setattr(
        "app.services.rag.get_settings",
        lambda: SimpleNamespace(
            openai_api_key="test-key",
            rerank_top_n=6,
        ),
    )
    monkeypatch.setattr("app.services.rag.embed_query", fake_embed_query)
    monkeypatch.setattr(
        "app.services.rag.retrieve_hybrid_chunks", fake_retrieve_hybrid_chunks
    )
    monkeypatch.setattr("app.services.rag.rerank_chunks", fake_rerank_chunks)
    monkeypatch.setattr(
        "app.services.rag.filter_non_chm_trial_chunks", fake_filter_non_chm_trial_chunks
    )

    question = "Tell me about REP1"
    await _prepare_question_context(question, _FakeSession())

    assert captured["embed_text"] == question
    assert "Rab escort protein" in str(captured["hybrid_query"])
