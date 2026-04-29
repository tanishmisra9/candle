from __future__ import annotations

from functools import lru_cache
from typing import Sequence

from openai import AsyncOpenAI

from app.config import get_settings
from app.services.openai_executor import run_openai_operation


@lru_cache
def _get_openai_client_for_key(api_key: str) -> AsyncOpenAI:
    return AsyncOpenAI(api_key=api_key)


def get_openai_client(api_key: str | None = None) -> AsyncOpenAI:
    resolved_key = api_key if api_key is not None else get_settings().openai_api_key
    return _get_openai_client_for_key(resolved_key)


def reset_openai_client_cache() -> None:
    _get_openai_client_for_key.cache_clear()


async def embed_texts(
    texts: Sequence[str],
    *,
    retries: int = 0,
    retry_backoff_seconds: float = 0.5,
) -> list[list[float]]:
    settings = get_settings()
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is required for embeddings.")
    if not texts:
        return []

    response = await run_openai_operation(
        lambda: get_openai_client(settings.openai_api_key).embeddings.create(
            model=settings.embedding_model,
            input=list(texts),
        ),
        timeout_seconds=settings.embedding_timeout_seconds,
        retries=retries,
        retry_backoff_seconds=retry_backoff_seconds,
    )
    return [item.embedding for item in response.data]


async def embed_query(text: str) -> list[float]:
    embeddings = await embed_texts([text], retries=0, retry_backoff_seconds=0)
    return embeddings[0]
