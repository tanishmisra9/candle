from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.db import get_session
from app.main import app


class DummyScalarResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class DummyExecuteResult:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return DummyScalarResult(self._rows)


class DummySyncSession:
    def __init__(self, rows):
        self.rows = rows
        self.statement = None

    async def execute(self, stmt):
        self.statement = stmt
        return DummyExecuteResult(self.rows[:5])


def override_session(session):
    async def _override():
        yield session

    return _override


def make_sync_log(index: int):
    started_at = datetime(2026, 4, 18, 12, 0, tzinfo=timezone.utc) - timedelta(hours=index)
    return SimpleNamespace(
        id=index,
        started_at=started_at,
        finished_at=started_at + timedelta(minutes=5),
        trials_ingested=index,
        publications_ingested=index + 10,
        publications_linked=index + 20,
        embeddings_stored=index + 30,
        summaries_generated=index + 40,
        status="success",
        error_message=None,
    )


def test_sync_status_returns_recent_sync_rows():
    rows = [make_sync_log(index) for index in range(1, 7)]
    session = DummySyncSession(rows)
    app.dependency_overrides[get_session] = override_session(session)
    client = TestClient(app)

    response = client.get("/sync/status")

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 5
    assert body[0]["id"] == 1
    assert body[0]["status"] == "success"
    assert set(body[0]) == {
        "id",
        "started_at",
        "finished_at",
        "trials_ingested",
        "publications_ingested",
        "publications_linked",
        "embeddings_stored",
        "summaries_generated",
        "status",
        "error_message",
    }

    sql = str(session.statement)
    assert "FROM sync_log" in sql
    assert "ORDER BY sync_log.started_at DESC" in sql
    assert "LIMIT" in sql

    app.dependency_overrides.clear()
