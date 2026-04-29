from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from typing import TypeVar


T = TypeVar("T")


class OpenAITimeoutError(RuntimeError):
    pass


class OpenAIServiceUnavailableError(RuntimeError):
    pass


async def run_openai_operation(
    operation: Callable[[], Awaitable[T]],
    *,
    timeout_seconds: float,
    retries: int = 0,
    retry_backoff_seconds: float = 0.5,
) -> T:
    attempt = 0

    while True:
        try:
            return await asyncio.wait_for(operation(), timeout=timeout_seconds)
        except asyncio.TimeoutError as exc:
            if attempt >= retries:
                raise OpenAITimeoutError("OpenAI request timed out.") from exc
        except Exception as exc:
            if attempt >= retries:
                raise OpenAIServiceUnavailableError("OpenAI request failed.") from exc

        attempt += 1
        await asyncio.sleep(retry_backoff_seconds * (2 ** (attempt - 1)))
