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
