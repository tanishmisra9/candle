from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.ingest import run


class FakeAsyncSession:
    def __init__(self, factory):
        self.factory = factory

    def add(self, obj):
        if obj.id is None:
            obj.id = self.factory.next_id
            self.factory.next_id += 1
        if obj.started_at is None:
            obj.started_at = datetime.now(timezone.utc)
        self.factory.sync_logs[obj.id] = obj

    async def commit(self):
        return None

    async def refresh(self, obj):
        return None

    async def get(self, model, key):
        return self.factory.sync_logs.get(key)


class FakeSessionContext:
    def __init__(self, factory):
        self.factory = factory
        self.session = FakeAsyncSession(factory)

    async def __aenter__(self):
        return self.session

    async def __aexit__(self, exc_type, exc, tb):
        return False


class FakeSessionFactory:
    def __init__(self):
        self.next_id = 1
        self.sync_logs = {}

    def __call__(self):
        return FakeSessionContext(self)


@pytest.mark.asyncio
async def test_run_main_marks_sync_log_success(monkeypatch):
    session_factory = FakeSessionFactory()
    call_order = []

    async def fake_ingest_trials(session):
        call_order.append("ingest_trials")
        return 3

    async def fake_ingest_publications(session):
        call_order.append("ingest_publications")
        return 4

    async def fake_link_publications_to_trials(session):
        call_order.append("link_publications_to_trials")
        return 5

    async def fake_generate_publication_overviews():
        call_order.append("generate_publication_overviews")
        return 6

    async def fake_store_embeddings(session):
        call_order.append("store_embeddings")
        return 7

    async def fake_generate_trial_summaries(session):
        call_order.append("generate_trial_summaries")
        return 8

    monkeypatch.setattr("app.ingest.run.AsyncSessionLocal", session_factory)
    monkeypatch.setattr("app.ingest.run.ingest_trials", fake_ingest_trials)
    monkeypatch.setattr("app.ingest.run.ingest_publications", fake_ingest_publications)
    monkeypatch.setattr(
        "app.ingest.run.link_publications_to_trials",
        fake_link_publications_to_trials,
    )
    monkeypatch.setattr(
        "app.ingest.run.generate_publication_overviews",
        fake_generate_publication_overviews,
    )
    monkeypatch.setattr("app.ingest.run.store_embeddings", fake_store_embeddings)
    monkeypatch.setattr(
        "app.ingest.run.generate_trial_summaries",
        fake_generate_trial_summaries,
    )

    await run.main()

    assert call_order == [
        "ingest_trials",
        "ingest_publications",
        "link_publications_to_trials",
        "generate_publication_overviews",
        "store_embeddings",
        "generate_trial_summaries",
    ]

    sync_log = session_factory.sync_logs[1]
    assert sync_log.status == "success"
    assert sync_log.trials_ingested == 3
    assert sync_log.publications_ingested == 4
    assert sync_log.publications_linked == 5
    assert sync_log.embeddings_stored == 7
    assert sync_log.summaries_generated == 8
    assert sync_log.error_message is None
    assert sync_log.finished_at is not None


@pytest.mark.asyncio
async def test_run_main_marks_sync_log_error_and_reraises(monkeypatch):
    session_factory = FakeSessionFactory()
    call_order = []

    async def fake_ingest_trials(session):
        call_order.append("ingest_trials")
        return 3

    async def fake_ingest_publications(session):
        call_order.append("ingest_publications")
        return 4

    async def fake_link_publications_to_trials(session):
        call_order.append("link_publications_to_trials")
        raise RuntimeError("link failed")

    monkeypatch.setattr("app.ingest.run.AsyncSessionLocal", session_factory)
    monkeypatch.setattr("app.ingest.run.ingest_trials", fake_ingest_trials)
    monkeypatch.setattr("app.ingest.run.ingest_publications", fake_ingest_publications)
    monkeypatch.setattr(
        "app.ingest.run.link_publications_to_trials",
        fake_link_publications_to_trials,
    )

    with pytest.raises(RuntimeError, match="link failed"):
        await run.main()

    assert call_order == [
        "ingest_trials",
        "ingest_publications",
        "link_publications_to_trials",
    ]

    sync_log = session_factory.sync_logs[1]
    assert sync_log.status == "error"
    assert sync_log.trials_ingested == 3
    assert sync_log.publications_ingested == 4
    assert sync_log.publications_linked == 0
    assert sync_log.embeddings_stored == 0
    assert sync_log.summaries_generated == 0
    assert sync_log.error_message == "link failed"
    assert sync_log.finished_at is not None
