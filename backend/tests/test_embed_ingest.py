from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from app.ingest.embed import (
    ChunkRecord,
    build_publication_records,
    changed_publication_page,
    changed_trial_page,
    store_chunk_records,
)


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


class DummyChangedPageSession:
    def __init__(self, rows, *, embedded_at_by_id: dict[str, datetime] | None = None):
        self.rows = rows
        self.embedded_at_by_id = embedded_at_by_id or {}

    async def execute(self, stmt):
        params = stmt.compile().params
        sql = str(stmt)
        limit = next(value for value in reversed(list(params.values())) if isinstance(value, int))

        if "FROM trials" in sql:
            cursor = params.get("id_1")
            page = [row for row in self.rows if cursor is None or row.id > cursor]
            page = [
                row
                for row in page
                if row.id not in self.embedded_at_by_id
                or row.updated_at > self.embedded_at_by_id[row.id]
            ]
        else:
            cursor = params.get("pmid_1")
            page = [row for row in self.rows if cursor is None or row.pmid > cursor]
            page = [
                row
                for row in page
                if row.pmid not in self.embedded_at_by_id
                or row.updated_at > self.embedded_at_by_id[row.pmid]
            ]

        return DummyExecuteResult(page[:limit])


class DummyStoreSession:
    def __init__(self):
        self.delete_statements = []
        self.added_rows = []
        self.commit_calls = 0

    async def execute(self, stmt):
        self.delete_statements.append(str(stmt))
        return DummyExecuteResult([])

    def add_all(self, rows):
        self.added_rows.extend(rows)

    async def commit(self):
        self.commit_calls += 1


def make_trial(trial_id: str, updated_at: datetime):
    return SimpleNamespace(
        id=trial_id,
        updated_at=updated_at,
        title=f"Trial {trial_id}",
        status="RECRUITING",
        phase="PHASE2",
        intervention="Gene therapy",
        primary_endpoint="BCVA",
        sponsor="Candle",
        enrollment=12,
        url=f"https://clinicaltrials.gov/study/{trial_id}",
    )


def make_publication(pmid: str, updated_at: datetime, abstract: str | None = "Abstract"):
    return SimpleNamespace(
        pmid=pmid,
        updated_at=updated_at,
        title=f"Publication {pmid}",
        abstract=abstract,
        journal="Journal",
        pub_date=None,
        url=f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
    )


@pytest.mark.asyncio
async def test_changed_trial_page_skips_unchanged_trials():
    now = datetime.now(timezone.utc)
    session = DummyChangedPageSession(
        [
            make_trial("NCT00000001", now - timedelta(days=1)),
            make_trial("NCT00000002", now),
        ],
        embedded_at_by_id={
            "NCT00000001": now,
            "NCT00000002": now - timedelta(days=2),
        },
    )

    changed_trials, next_last_id = await changed_trial_page(session, last_id=None)

    assert [trial.id for trial in changed_trials] == ["NCT00000002"]
    assert next_last_id == "NCT00000002"


@pytest.mark.asyncio
async def test_changed_publication_page_skips_unchanged_publications():
    now = datetime.now(timezone.utc)
    session = DummyChangedPageSession(
        [
            make_publication("PMID1", now - timedelta(days=1)),
            make_publication("PMID2", now),
        ],
        embedded_at_by_id={
            "PMID1": now,
            "PMID2": now - timedelta(days=2),
        },
    )

    changed_publications, next_last_pmid = await changed_publication_page(session, last_pmid=None)

    assert [publication.pmid for publication in changed_publications] == ["PMID2"]
    assert next_last_pmid == "PMID2"


def test_build_publication_records_splits_multi_chunk_sources():
    encoding = SimpleNamespace(encode=lambda text: list(range(len(text) // 4 + 1)))
    long_abstract = "\n\n".join(["A" * 2400, "B" * 2400, "C" * 2400])
    publication = make_publication("PMID-LONG", datetime.now(timezone.utc), abstract=long_abstract)

    records = build_publication_records([publication], encoding)

    assert len(records) > 1
    assert {record.source_id for record in records} == {"PMID-LONG"}


@pytest.mark.asyncio
async def test_store_chunk_records_batches_embedding_calls(monkeypatch):
    session = DummyStoreSession()
    embed_batch_sizes = []

    async def fake_embed_texts(texts, *, retries=0, retry_backoff_seconds=0.5):
        embed_batch_sizes.append(len(texts))
        return [[0.1, 0.2, 0.3] for _ in texts]

    monkeypatch.setattr("app.ingest.embed.embed_texts", fake_embed_texts)

    chunks = [
        ChunkRecord(
            source_type="publication",
            source_id=f"PMID{i // 2}",
            content=f"Chunk {i}",
            metadata={"title": "Title"},
        )
        for i in range(101)
    ]

    stored_count = await store_chunk_records(session, chunks)

    assert stored_count == 101
    assert embed_batch_sizes == [101]
    assert len(session.delete_statements) == 1
    assert len(session.added_rows) == 101
    assert session.commit_calls == 1
