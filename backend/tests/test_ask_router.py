from fastapi.testclient import TestClient

from app.db import get_session
from app.main import app
from app.services.openai_executor import (
    OpenAIServiceUnavailableError,
    OpenAITimeoutError,
)


class DummySession:
    pass


def override_session():
    async def _override():
        yield DummySession()

    return _override


def test_ask_returns_504_when_openai_times_out(monkeypatch):
    async def fake_answer_question(question, session):
        raise OpenAITimeoutError("OpenAI request timed out.")

    app.dependency_overrides[get_session] = override_session()
    monkeypatch.setattr("app.routers.ask.answer_question", fake_answer_question)
    client = TestClient(app)

    response = client.post("/ask", json={"question": "What is recruiting?"})

    assert response.status_code == 504
    assert response.json()["detail"] == "Ask request timed out."

    app.dependency_overrides.clear()


def test_ask_returns_503_when_openai_is_unavailable(monkeypatch):
    async def fake_answer_question(question, session):
        raise OpenAIServiceUnavailableError("OpenAI request failed.")

    app.dependency_overrides[get_session] = override_session()
    monkeypatch.setattr("app.routers.ask.answer_question", fake_answer_question)
    client = TestClient(app)

    response = client.post("/ask", json={"question": "What is recruiting?"})

    assert response.status_code == 503
    assert response.json()["detail"] == "The AI service is temporarily unavailable."

    app.dependency_overrides.clear()


def test_ask_stream_ends_with_an_error_event_when_the_pipeline_crashes_midway(monkeypatch):
    # An unexpected exception (not RuntimeError / OpenAI) used to kill the generator after the
    # response had started: the client saw the stream just stop, with no done and no error.
    import json

    async def crashing_stream(question, session):
        yield json.dumps({"type": "delta", "delta": "Partial "})
        raise ValueError("secret internal detail")

    app.dependency_overrides[get_session] = override_session()
    monkeypatch.setattr("app.routers.ask.answer_question_stream", crashing_stream)
    client = TestClient(app)

    response = client.post("/ask/stream", json={"question": "What is recruiting?"})

    assert response.status_code == 200
    events = [json.loads(line[6:]) for line in response.text.split("\n\n") if line.startswith("data: ")]
    assert [e["type"] for e in events] == ["delta", "error"]
    assert "secret internal detail" not in response.text

    app.dependency_overrides.clear()


def test_ask_stream_does_not_send_runtime_error_text_to_the_browser(monkeypatch):
    # RuntimeError carries config and driver messages ("OPENAI_API_KEY is required...", asyncio and
    # database internals). It used to be sent verbatim as the SSE error detail, unlike every other
    # unexpected failure.
    import json

    async def failing_stream(question, session):
        raise RuntimeError("secret internal detail")
        yield  # pragma: no cover - makes this an async generator

    app.dependency_overrides[get_session] = override_session()
    monkeypatch.setattr("app.routers.ask.answer_question_stream", failing_stream)
    client = TestClient(app)

    response = client.post("/ask/stream", json={"question": "What is recruiting?"})

    events = [json.loads(line[6:]) for line in response.text.split("\n\n") if line.startswith("data: ")]
    assert [e["type"] for e in events] == ["error"]
    assert events[0]["detail"] == "Something went wrong while answering. Please try again."
    assert "secret internal detail" not in response.text

    app.dependency_overrides.clear()


def test_ask_does_not_send_runtime_error_text_to_the_browser(monkeypatch):
    async def failing_answer(question, session):
        raise RuntimeError("secret internal detail")

    app.dependency_overrides[get_session] = override_session()
    monkeypatch.setattr("app.routers.ask.answer_question", failing_answer)
    client = TestClient(app)

    response = client.post("/ask", json={"question": "What is recruiting?"})

    assert response.status_code == 500
    assert response.json()["detail"] == "Something went wrong while answering. Please try again."
    assert "secret internal detail" not in response.text

    app.dependency_overrides.clear()


def test_ask_busy_is_still_a_503_not_turned_into_a_generic_500(monkeypatch):
    # The concurrency slot raises its own HTTPException(503) INSIDE the try block that now has a
    # catch-all: it must pass through.
    from contextlib import asynccontextmanager

    from fastapi import HTTPException

    @asynccontextmanager
    async def busy_slot():
        raise HTTPException(status_code=503, detail="The AI service is handling too many requests right now.")
        yield  # pragma: no cover

    app.dependency_overrides[get_session] = override_session()
    monkeypatch.setattr("app.routers.ask.llm_concurrency_slot", busy_slot)
    client = TestClient(app)

    response = client.post("/ask", json={"question": "What is recruiting?"})

    assert response.status_code == 503
    assert "too many requests" in response.json()["detail"]

    app.dependency_overrides.clear()


def test_a_timeout_is_still_a_timeout_not_a_generic_failure(monkeypatch):
    # OpenAITimeoutError and OpenAIServiceUnavailableError are RuntimeError subclasses: removing the
    # RuntimeError clause must not swallow them into the generic message.
    import json

    async def timing_out_stream(question, session):
        raise OpenAITimeoutError("OpenAI request timed out.")
        yield  # pragma: no cover

    app.dependency_overrides[get_session] = override_session()
    monkeypatch.setattr("app.routers.ask.answer_question_stream", timing_out_stream)
    client = TestClient(app)

    response = client.post("/ask/stream", json={"question": "What is recruiting?"})

    events = [json.loads(line[6:]) for line in response.text.split("\n\n") if line.startswith("data: ")]
    assert events == [{"type": "error", "detail": "Ask request timed out."}]

    app.dependency_overrides.clear()
