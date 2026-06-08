from __future__ import annotations

import logging
from functools import lru_cache

import cohere

from app.config import get_settings
from app.services.openai_executor import run_openai_operation
from app.services.retrieval import RetrievedChunk


logger = logging.getLogger("candle.api")


@lru_cache
def _get_cohere_client(api_key: str) -> cohere.AsyncClientV2:
    return cohere.AsyncClientV2(api_key=api_key)


def get_cohere_client(api_key: str | None = None) -> cohere.AsyncClientV2:
    resolved_key = api_key if api_key is not None else get_settings().cohere_api_key
    return _get_cohere_client(resolved_key)


def reset_cohere_client_cache() -> None:
    _get_cohere_client.cache_clear()


async def rerank_chunks(
    query: str,
    chunks: list[RetrievedChunk],
    top_n: int,
) -> list[RetrievedChunk]:
    """Rerank chunks via Cohere Rerank, returning the top_n by relevance.

    Returns chunks[:top_n] unchanged when reranking is disabled, no API key is
    configured, or the API call fails. Reranking failures never break the request.
    """
    settings = get_settings()
    if not settings.rerank_enabled or not settings.cohere_api_key or not chunks:
        return chunks[:top_n]

    try:
        response = await run_openai_operation(
            # Cohere V2 rerank does not echo documents back by default (no
            # return_documents flag), so we only receive index + relevance_score,
            # which is exactly the low-bandwidth response we want.
            lambda: get_cohere_client(settings.cohere_api_key).rerank(
                model=settings.rerank_model,
                query=query,
                documents=[chunk.content for chunk in chunks],
                top_n=top_n,
            ),
            timeout_seconds=settings.rerank_timeout_seconds,
            retries=settings.background_openai_max_retries,
            retry_backoff_seconds=settings.background_openai_retry_backoff_seconds,
        )
    except Exception:
        logger.warning("Cohere rerank failed; falling back to pre-rerank order.", exc_info=True)
        return chunks[:top_n]

    reranked: list[RetrievedChunk] = []
    for result in response.results:
        if result.index < 0 or result.index >= len(chunks):
            continue
        chunk = chunks[result.index]
        chunk.distance = 1.0 - float(result.relevance_score)
        reranked.append(chunk)

    return reranked or chunks[:top_n]
