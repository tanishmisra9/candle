from fastapi.testclient import TestClient

from app.db import get_session
from app.main import app


class DummySession:
    pass


async def override_session():
    yield DummySession()


def test_healthz():
    client = TestClient(app)
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"ok": True}


def test_ask_smoke(monkeypatch):
    async def fake_answer(question, session):
        return {
            "answer": f"Grounded answer for: {question}",
            "sources": [
                {
                    "source_type": "trial",
                    "source_id": "NCT00000000",
                    "title": "Mock Trial",
                    "url": "https://clinicaltrials.gov/study/NCT00000000",
                }
            ],
        }

    app.dependency_overrides[get_session] = override_session
    monkeypatch.setattr("app.routers.ask.answer_question", fake_answer)
    client = TestClient(app)

    response = client.post("/ask", json={"question": "which trials are recruiting?"})
    assert response.status_code == 200
    body = response.json()
    assert "Grounded answer" in body["answer"]
    assert body["sources"][0]["source_id"] == "NCT00000000"

    app.dependency_overrides.clear()
