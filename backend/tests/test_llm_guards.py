from __future__ import annotations

from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.db import get_session
from app.main import app


class DummySession:
    def __init__(self, publications: dict[str, object] | None = None):
        self.publications = publications or {}

    async def get(self, model, key):
        return self.publications.get(key)


def override_session(session):
    async def _override():
        yield session

    return _override


def make_guard_settings(**overrides):
    payload = {
        "trust_proxy_headers": False,
        "ask_rate_limit_per_minute": 6,
        "ask_rate_limit_burst": 2,
        "publication_overview_rate_limit_per_minute": 20,
        "publication_overview_rate_limit_burst": 5,
        "llm_concurrency_limit": 8,
        "llm_request_body_max_bytes": 8 * 1024,
        "ask_question_max_chars": 2000,
    }
    payload.update(overrides)
    return SimpleNamespace(**payload)


def test_ask_rate_limit_returns_429(monkeypatch):
    app.dependency_overrides[get_session] = override_session(DummySession())
    monkeypatch.setattr(
        "app.services.llm_guardrails.get_settings",
        lambda: make_guard_settings(ask_rate_limit_per_minute=1, ask_rate_limit_burst=0),
    )

    async def fake_answer_question(question, session):
        return {"answer": "ok", "sources": []}

    monkeypatch.setattr("app.routers.ask.answer_question", fake_answer_question)
    client = TestClient(app)

    first = client.post("/ask", json={"question": "What is recruiting?"})
    second = client.post("/ask", json={"question": "What is recruiting?"})

    assert first.status_code == 200
    assert second.status_code == 429
    assert second.headers["Retry-After"] == "60"

    app.dependency_overrides.clear()


def test_publication_overview_rate_limit_returns_429(monkeypatch):
    publication = SimpleNamespace(pmid="PMID1", abstract="A CHM abstract.")
    app.dependency_overrides[get_session] = override_session(
        DummySession({"PMID1": publication})
    )
    monkeypatch.setattr(
        "app.services.llm_guardrails.get_settings",
        lambda: make_guard_settings(
            publication_overview_rate_limit_per_minute=1,
            publication_overview_rate_limit_burst=0,
        ),
    )

    async def fake_get_or_generate(session, publication, force=False):
        return "overview", False

    monkeypatch.setattr(
        "app.routers.publications.get_or_generate_publication_overview",
        fake_get_or_generate,
    )
    client = TestClient(app)

    first = client.post("/publications/PMID1/overview")
    second = client.post("/publications/PMID1/overview")

    assert first.status_code == 200
    assert second.status_code == 429
    assert second.headers["Retry-After"] == "60"

    app.dependency_overrides.clear()


def test_ask_rejects_question_over_max_length(monkeypatch):
    app.dependency_overrides[get_session] = override_session(DummySession())
    monkeypatch.setattr(
        "app.services.llm_guardrails.get_settings",
        lambda: make_guard_settings(ask_question_max_chars=5_000),
    )
    client = TestClient(app)

    response = client.post("/ask", json={"question": "x" * 6_000})

    assert response.status_code == 413
    assert response.json()["detail"] == "Question is too long for this endpoint."

    app.dependency_overrides.clear()


def test_ask_rejects_request_bodies_over_limit(monkeypatch):
    app.dependency_overrides[get_session] = override_session(DummySession())
    monkeypatch.setattr(
        "app.middleware.get_settings",
        lambda: make_guard_settings(
            ask_question_max_chars=10_000,
            llm_request_body_max_bytes=100,
        ),
    )
    client = TestClient(app)

    response = client.post("/ask", json={"question": "x" * 150})

    assert response.status_code == 413
    assert response.json()["detail"] == "Request body is too large for this endpoint."

    app.dependency_overrides.clear()


def test_ask_rejects_oversized_invalid_json_before_handler_runs(monkeypatch):
    app.dependency_overrides[get_session] = override_session(DummySession())
    handler_called = False

    monkeypatch.setattr(
        "app.middleware.get_settings",
        lambda: make_guard_settings(llm_request_body_max_bytes=100),
    )

    async def fake_answer_question(question, session):
        nonlocal handler_called
        handler_called = True
        return {"answer": "ok", "sources": []}

    monkeypatch.setattr("app.routers.ask.answer_question", fake_answer_question)
    client = TestClient(app)

    response = client.post(
        "/ask",
        content=b'{"question":"' + (b"x" * 200) + b'"',
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 413
    assert response.json()["detail"] == "Request body is too large for this endpoint."
    assert handler_called is False

    app.dependency_overrides.clear()


def test_publication_overview_rejects_oversized_body_before_route_runs(monkeypatch):
    publication = SimpleNamespace(pmid="PMID1", abstract="A CHM abstract.")
    app.dependency_overrides[get_session] = override_session(
        DummySession({"PMID1": publication})
    )
    route_called = False

    monkeypatch.setattr(
        "app.middleware.get_settings",
        lambda: make_guard_settings(llm_request_body_max_bytes=100),
    )

    async def fake_get_or_generate(session, publication, force=False):
        nonlocal route_called
        route_called = True
        return "overview", False

    monkeypatch.setattr(
        "app.routers.publications.get_or_generate_publication_overview",
        fake_get_or_generate,
    )
    client = TestClient(app)

    response = client.post(
        "/publications/PMID1/overview",
        content=b"{" + (b"x" * 200) + b"}",
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 413
    assert response.json()["detail"] == "Request body is too large for this endpoint."
    assert route_called is False

    app.dependency_overrides.clear()


def test_ask_returns_503_when_llm_capacity_is_exhausted(monkeypatch):
    app.dependency_overrides[get_session] = override_session(DummySession())
    monkeypatch.setattr(
        "app.services.llm_guardrails.get_settings",
        lambda: make_guard_settings(llm_concurrency_limit=0),
    )
    client = TestClient(app)

    response = client.post("/ask", json={"question": "What is recruiting?"})

    assert response.status_code == 503
    assert "too many requests right now" in response.json()["detail"].lower()

    app.dependency_overrides.clear()


def test_rate_limiting_uses_first_forwarded_ip_when_trusted(monkeypatch):
    app.dependency_overrides[get_session] = override_session(DummySession())
    monkeypatch.setattr(
        "app.services.llm_guardrails.get_settings",
        lambda: make_guard_settings(
            trust_proxy_headers=True,
            ask_rate_limit_per_minute=1,
            ask_rate_limit_burst=0,
        ),
    )

    async def fake_answer_question(question, session):
        return {"answer": "ok", "sources": []}

    monkeypatch.setattr("app.routers.ask.answer_question", fake_answer_question)
    client = TestClient(app)

    first = client.post(
        "/ask",
        json={"question": "What is recruiting?"},
        headers={"X-Forwarded-For": " 203.0.113.10 , 10.0.0.2 "},
    )
    second = client.post(
        "/ask",
        json={"question": "What is recruiting?"},
        headers={"X-Forwarded-For": "203.0.113.10"},
    )
    third = client.post(
        "/ask",
        json={"question": "What is recruiting?"},
        headers={"X-Forwarded-For": "198.51.100.8, 10.0.0.2"},
    )

    assert first.status_code == 200
    assert second.status_code == 429
    assert third.status_code == 200

    app.dependency_overrides.clear()


def test_ask_stream_rejects_request_bodies_over_limit(monkeypatch):
    # /ask/stream is the endpoint the UI uses; it must get the same body cap as /ask.
    app.dependency_overrides[get_session] = override_session(DummySession())
    handler_called = False

    monkeypatch.setattr(
        "app.middleware.get_settings",
        lambda: make_guard_settings(llm_request_body_max_bytes=100),
    )

    async def fake_stream(question, session):
        nonlocal handler_called
        handler_called = True
        yield '{"type": "done", "answer": "ok", "sources": []}'

    monkeypatch.setattr("app.routers.ask.answer_question_stream", fake_stream)
    client = TestClient(app)

    response = client.post("/ask/stream", json={"question": "x" * 150})

    assert response.status_code == 413
    assert response.json()["detail"] == "Request body is too large for this endpoint."
    assert handler_called is False

    app.dependency_overrides.clear()


def test_ask_stream_rejects_oversized_body_without_content_length(monkeypatch):
    # A client can omit or understate Content-Length; the streamed byte count must still be capped.
    app.dependency_overrides[get_session] = override_session(DummySession())
    monkeypatch.setattr(
        "app.middleware.get_settings",
        lambda: make_guard_settings(llm_request_body_max_bytes=100),
    )
    client = TestClient(app)

    def chunks():
        yield b'{"question":"'
        yield b"x" * 200
        yield b'"}'

    response = client.post(
        "/ask/stream",
        content=chunks(),
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 413
    assert response.json()["detail"] == "Request body is too large for this endpoint."

    app.dependency_overrides.clear()


def test_body_limit_matches_only_llm_post_routes():
    from app.middleware import is_llm_endpoint

    assert is_llm_endpoint("POST", "/ask")
    assert is_llm_endpoint("POST", "/ask/stream")
    assert is_llm_endpoint("POST", "/publications/123/overview")
    assert not is_llm_endpoint("GET", "/ask/stream")
    assert not is_llm_endpoint("POST", "/ask/stream/extra")
    assert not is_llm_endpoint("POST", "/trials")


async def _run_middleware(inner_app):
    from app.middleware import LLMRequestBodyLimitMiddleware

    sent: list[dict] = []

    async def receive():
        return {"type": "http.request", "body": b"{}", "more_body": False}

    async def send(message):
        sent.append(message)

    scope = {"type": "http", "method": "POST", "path": "/ask", "headers": [(b"content-length", b"2")]}
    middleware = LLMRequestBodyLimitMiddleware(inner_app)
    return middleware, scope, receive, send, sent


async def test_body_too_large_before_the_response_starts_is_a_413():
    from app.middleware import LLMRequestBodyTooLarge

    async def inner(scope, receive, send):
        raise LLMRequestBodyTooLarge

    middleware, scope, receive, send, sent = await _run_middleware(inner)
    await middleware(scope, receive, send)

    assert sent[0]["type"] == "http.response.start"
    assert sent[0]["status"] == 413


async def test_body_too_large_after_the_response_started_is_re_raised_not_a_second_response():
    import pytest

    from app.middleware import LLMRequestBodyTooLarge

    async def inner(scope, receive, send):
        await send({"type": "http.response.start", "status": 200, "headers": []})
        raise LLMRequestBodyTooLarge

    middleware, scope, receive, send, sent = await _run_middleware(inner)
    with pytest.raises(LLMRequestBodyTooLarge):
        await middleware(scope, receive, send)

    # Exactly one response start: sending a 413 on top would break the ASGI protocol.
    assert [m["type"] for m in sent].count("http.response.start") == 1
