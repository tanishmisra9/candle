import logging

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import ProgrammingError

from app.db import get_session, reconcile_database_schema
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


def test_startup_warns_when_openai_key_missing(monkeypatch, caplog):
    monkeypatch.setattr("app.main.settings.openai_api_key", "")

    with caplog.at_level(logging.WARNING, logger="candle.api"):
        with TestClient(app) as client:
            response = client.get("/healthz")

    assert response.status_code == 200
    assert (
        "OPENAI_API_KEY is not set. The /ask endpoint and publication overviews "
        "will not function until it is configured in .env."
    ) in caplog.text


def test_startup_reconciles_database_schema(monkeypatch):
    called = False

    async def fake_reconcile_database_schema():
        nonlocal called
        called = True

    monkeypatch.setattr("app.main.reconcile_database_schema", fake_reconcile_database_schema)

    with TestClient(app):
        pass

    assert called is True


class FakeConnection:
    def __init__(self, fail_pattern: str | None = None):
        self.statements = []
        self.fail_pattern = fail_pattern

    async def execute(self, statement):
        sql = str(statement)
        self.statements.append(sql)
        if self.fail_pattern and self.fail_pattern in sql:
            raise ProgrammingError(sql, {}, Exception("unsupported"))


class FakeBegin:
    def __init__(self, connection):
        self.connection = connection

    async def __aenter__(self):
        return self.connection

    async def __aexit__(self, exc_type, exc, tb):
        return False


class FakeEngine:
    def __init__(self, fail_pattern: str | None = None):
        self.connection = FakeConnection(fail_pattern=fail_pattern)

    def begin(self):
        return FakeBegin(self.connection)


@pytest.mark.asyncio
async def test_reconcile_database_schema_applies_trial_summary_and_sync_log_changes(
    monkeypatch,
):
    fake_engine = FakeEngine()
    monkeypatch.setattr("app.db.engine", fake_engine)

    await reconcile_database_schema()

    sql = "\n".join(fake_engine.connection.statements)
    assert "CREATE EXTENSION IF NOT EXISTS pg_trgm" in sql
    assert "ALTER TABLE trials" in sql
    assert "ADD COLUMN IF NOT EXISTS ai_summary TEXT" in sql
    assert "ADD COLUMN IF NOT EXISTS ai_summary_generated_at TIMESTAMPTZ" in sql
    assert "CREATE TABLE IF NOT EXISTS sync_log" in sql
    assert "CREATE INDEX IF NOT EXISTS idx_trials_title_trgm" in sql
    assert "CREATE INDEX IF NOT EXISTS idx_trials_sponsor_trgm" in sql
    assert "CREATE INDEX IF NOT EXISTS idx_publications_title_trgm" in sql
    assert "CREATE INDEX IF NOT EXISTS idx_publications_abstract_trgm" in sql


@pytest.mark.asyncio
async def test_reconcile_database_schema_warns_in_development_when_pg_trgm_is_unavailable(
    monkeypatch, caplog
):
    fake_engine = FakeEngine(fail_pattern="CREATE EXTENSION IF NOT EXISTS pg_trgm")
    monkeypatch.setattr("app.db.engine", fake_engine)
    monkeypatch.setattr("app.db.settings.deployment_env", "development")

    with caplog.at_level(logging.WARNING, logger="candle.api"):
        await reconcile_database_schema()

    assert "Skipping schema statement during development" in caplog.text


@pytest.mark.asyncio
async def test_reconcile_database_schema_raises_in_production_when_pg_trgm_is_unavailable(
    monkeypatch,
):
    fake_engine = FakeEngine(fail_pattern="CREATE EXTENSION IF NOT EXISTS pg_trgm")
    monkeypatch.setattr("app.db.engine", fake_engine)
    monkeypatch.setattr("app.db.settings.deployment_env", "production")

    with pytest.raises(ProgrammingError):
        await reconcile_database_schema()


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
