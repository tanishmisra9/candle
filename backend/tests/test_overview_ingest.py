from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.ingest.overviews import generate_publication_overviews


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


class DummyOverviewSession:
    def __init__(self, publications):
        self.publications = {publication.pmid: publication for publication in publications}

    async def scalar(self, stmt):
        return len(self.publications)

    async def execute(self, stmt):
        params = stmt.compile().params
        limit = next(value for value in reversed(list(params.values())) if isinstance(value, int))
        cursor = params.get("pmid_1")
        rows = [
            publication
            for publication in sorted(self.publications.values(), key=lambda item: item.pmid)
            if cursor is None or publication.pmid > cursor
        ]
        return DummyExecuteResult(rows[:limit])

    async def get(self, model, key):
        return self.publications.get(key)


class DummySessionContext:
    def __init__(self, session, counter):
        self.session = session
        self.counter = counter

    async def __aenter__(self):
        self.counter["entries"] += 1
        return self.session

    async def __aexit__(self, exc_type, exc, tb):
        return False


def make_publication(pmid: str):
    return SimpleNamespace(
        pmid=pmid,
        abstract="Abstract",
        title=f"Publication {pmid}",
    )


@pytest.mark.asyncio
async def test_generate_publication_overviews_pages_and_reuses_one_session(monkeypatch):
    counter = {"entries": 0}
    session = DummyOverviewSession(
        [make_publication("PMID1"), make_publication("PMID2"), make_publication("PMID3")]
    )
    processed_pmids = []

    def fake_session_factory():
        return DummySessionContext(session, counter)

    async def fake_get_or_generate_publication_overview(current_session, publication, force=False):
        processed_pmids.append(publication.pmid)
        return "overview", True

    monkeypatch.setattr("app.ingest.overviews.AsyncSessionLocal", fake_session_factory)
    monkeypatch.setattr("app.ingest.overviews.OVERVIEW_PAGE_SIZE", 2)
    monkeypatch.setattr(
        "app.ingest.overviews.get_or_generate_publication_overview",
        fake_get_or_generate_publication_overview,
    )

    generated_count = await generate_publication_overviews(force=False)

    assert generated_count == 3
    assert processed_pmids == ["PMID1", "PMID2", "PMID3"]
    assert counter["entries"] == 1
