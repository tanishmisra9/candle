from __future__ import annotations

import asyncio
import math
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from dataclasses import dataclass

from fastapi import HTTPException, Request

from app.config import get_settings


ASK_ROUTE = "ask"
PUBLICATION_OVERVIEW_ROUTE = "publication_overview"


@dataclass(frozen=True)
class RouteLimit:
    limit_per_minute: int
    burst: int


class SlidingWindowLimiter:
    def __init__(self) -> None:
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()

    async def check(self, key: str, limit: RouteLimit) -> int | None:
        now = time.monotonic()
        cutoff = now - 60
        max_requests = limit.limit_per_minute + limit.burst

        async with self._lock:
            window = self._events[key]
            while window and window[0] <= cutoff:
                window.popleft()

            if len(window) >= max_requests:
                retry_after = max(1, math.ceil(60 - (now - window[0])))
                return retry_after

            window.append(now)
            return None

    def reset(self) -> None:
        self._events.clear()


class ConcurrencyLimiter:
    def __init__(self) -> None:
        self._current = 0
        self._lock = asyncio.Lock()

    async def acquire(self, limit: int) -> bool:
        async with self._lock:
            if self._current >= limit:
                return False
            self._current += 1
            return True

    async def release(self) -> None:
        async with self._lock:
            if self._current > 0:
                self._current -= 1

    def reset(self) -> None:
        self._current = 0


_rate_limiter = SlidingWindowLimiter()
_concurrency_limiter = ConcurrencyLimiter()


def route_limit(route_name: str) -> RouteLimit:
    settings = get_settings()
    if route_name == ASK_ROUTE:
        return RouteLimit(
            limit_per_minute=settings.ask_rate_limit_per_minute,
            burst=settings.ask_rate_limit_burst,
        )
    if route_name == PUBLICATION_OVERVIEW_ROUTE:
        return RouteLimit(
            limit_per_minute=settings.publication_overview_rate_limit_per_minute,
            burst=settings.publication_overview_rate_limit_burst,
        )
    raise ValueError(f"Unknown LLM route: {route_name}")


def request_body_limit_bytes() -> int:
    return get_settings().llm_request_body_max_bytes


def ask_question_max_chars() -> int:
    return get_settings().ask_question_max_chars


def client_ip_from_request(request: Request) -> str:
    settings = get_settings()
    if settings.trust_proxy_headers:
        forwarded_for = request.headers.get("x-forwarded-for", "")
        parts = [part.strip() for part in forwarded_for.split(",") if part.strip()]
        if parts:
            return parts[0]

    if request.client and request.client.host:
        return request.client.host
    return "unknown"


async def enforce_llm_rate_limit(request: Request, route_name: str) -> None:
    limit = route_limit(route_name)
    key = f"{route_name}:{client_ip_from_request(request)}"
    retry_after = await _rate_limiter.check(key, limit)
    if retry_after is not None:
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded for this endpoint.",
            headers={"Retry-After": str(retry_after)},
        )


@asynccontextmanager
async def llm_concurrency_slot():
    settings = get_settings()
    acquired = await _concurrency_limiter.acquire(settings.llm_concurrency_limit)
    if not acquired:
        raise HTTPException(
            status_code=503,
            detail="The AI service is handling too many requests right now. Please try again shortly.",
        )

    try:
        yield
    finally:
        await _concurrency_limiter.release()


def reset_llm_protection_state() -> None:
    _rate_limiter.reset()
    _concurrency_limiter.reset()
