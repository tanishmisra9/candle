from __future__ import annotations

from functools import lru_cache
from typing import Sequence

from openai import AsyncOpenAI

from app.config import get_settings
from app.services.openai_executor import run_openai_operation


settings = get_settings()


@lru_cache
def get_openai_client() -> AsyncOpenAI:
    return AsyncOpenAI(api_key=settings.openai_api_key)


async def embed_texts(texts: Sequence[str]) -> list[list[float]]:
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is required for embeddings.")
    if not texts:
        return []

    response = await run_openai_operation(
        lambda: get_openai_client().embeddings.create(
            model=settings.embedding_model,
            input=list(texts),
        ),
        timeout_seconds=settings.embedding_timeout_seconds,
    )
    return [item.embedding for item in response.data]


async def embed_query(text: str) -> list[float]:
    embeddings = await embed_texts([text])
    return embeddings[0]
