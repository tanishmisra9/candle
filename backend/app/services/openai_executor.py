from __future__ import annotations

import asyncio
import random
from collections.abc import Awaitable, Callable
from typing import TypeVar

import httpx


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
        base_delay = retry_backoff_seconds * (2 ** (attempt - 1))
        jitter = random.uniform(0, base_delay * 0.25)
        await asyncio.sleep(base_delay + jitter)


async def run_http_request(
    operation: Callable[[], Awaitable[httpx.Response]],
    *,
    retries: int = 3,
    retry_backoff_seconds: float = 0.5,
    retry_statuses: frozenset[int] = frozenset({408, 429, 500, 502, 503, 504}),
) -> httpx.Response:
    attempt = 0

    while True:
        try:
            response = await operation()
            if response.status_code not in retry_statuses or attempt >= retries:
                response.raise_for_status()
                return response
        except (httpx.TimeoutException, httpx.TransportError):
            if attempt >= retries:
                raise

        attempt += 1
        base_delay = retry_backoff_seconds * (2 ** (attempt - 1))
        jitter = random.uniform(0, base_delay * 0.25)
        await asyncio.sleep(base_delay + jitter)
