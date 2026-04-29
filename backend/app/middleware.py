from __future__ import annotations

import re
from collections.abc import Awaitable, Callable

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.config import get_settings


_PUBLICATION_OVERVIEW_PATH = re.compile(r"^/publications/[^/]+/overview$")


def is_llm_endpoint(method: str, path: str) -> bool:
    if method != "POST":
        return False
    if path == "/ask":
        return True
    return bool(_PUBLICATION_OVERVIEW_PATH.match(path))


def llm_request_body_limit_bytes() -> int:
    return get_settings().llm_request_body_max_bytes


def parse_content_length(headers: list[tuple[bytes, bytes]]) -> int | None:
    for key, value in headers:
        if key.lower() != b"content-length":
            continue
        try:
            return int(value.decode("latin-1").strip())
        except ValueError:
            return None
    return None


class LLMRequestBodyTooLarge(Exception):
    pass


class LLMRequestBodyLimitMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        method = scope.get("method", "").upper()
        path = scope.get("path", "")
        if not is_llm_endpoint(method, path):
            await self.app(scope, receive, send)
            return

        limit = llm_request_body_limit_bytes()
        content_length = parse_content_length(scope.get("headers", []))
        if content_length is not None and content_length > limit:
            await JSONResponse(
                status_code=413,
                content={"detail": "Request body is too large for this endpoint."},
            )(scope, receive, send)
            return

        body_bytes_seen = 0

        async def limited_receive() -> Message:
            nonlocal body_bytes_seen

            message = await receive()
            if message["type"] != "http.request":
                return message

            body = message.get("body", b"")
            body_bytes_seen += len(body)
            if body_bytes_seen > limit:
                raise LLMRequestBodyTooLarge
            return message

        try:
            await self.app(scope, limited_receive, send)
        except LLMRequestBodyTooLarge:
            await JSONResponse(
                status_code=413,
                content={"detail": "Request body is too large for this endpoint."},
            )(scope, receive, send)
