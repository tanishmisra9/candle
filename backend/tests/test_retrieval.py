from __future__ import annotations

from app.services.retrieval import RetrievedChunk, _fuse_rankings


def make_chunk(source_id: str) -> RetrievedChunk:
    return RetrievedChunk(
        source_type="trial",
        source_id=source_id,
        content=f"content {source_id}",
        title=source_id,
        url=None,
        metadata={},
        distance=0.5,
    )


def test_rrf_rewards_agreement_across_rankings():
    a, b, c = make_chunk("A"), make_chunk("B"), make_chunk("C")
    dense = [a, b, c]
    bm25 = [b, c, a]

    fused = _fuse_rankings([dense, bm25], limit=3)

    # B is rank 1 in dense and rank 0 in bm25 -> highest fused score
    assert fused[0].source_id == "B"
    assert {chunk.source_id for chunk in fused} == {"A", "B", "C"}


def test_rrf_normalizes_distance_to_unit_range():
    a, b, c = make_chunk("A"), make_chunk("B"), make_chunk("C")
    fused = _fuse_rankings([[a, b, c], [a, b, c]], limit=3)

    distances = [chunk.distance for chunk in fused]
    assert min(distances) == 0.0
    assert max(distances) == 1.0
    for distance in distances:
        assert 0.0 <= distance <= 1.0


def test_rrf_deduplicates_by_source_key():
    a1 = make_chunk("A")
    a2 = make_chunk("A")
    b = make_chunk("B")

    fused = _fuse_rankings([[a1, b], [a2, b]], limit=10)

    assert len(fused) == 2


def test_rrf_single_candidate_distance_zero():
    fused = _fuse_rankings([[make_chunk("A")]], limit=5)

    assert len(fused) == 1
    assert fused[0].distance == 0.0


def test_rrf_empty_returns_empty():
    assert _fuse_rankings([[], []], limit=5) == []


def test_rrf_cross_ranked_lists_beat_mid_ranked_in_both():
    x = make_chunk("X")
    y = make_chunk("Y")
    m = make_chunk("M")
    dense_fillers = [make_chunk(f"D{i}") for i in range(48)]
    bm25_fillers = [make_chunk(f"B{i}") for i in range(48)]

    dense = [y, *dense_fillers[:24], m, *dense_fillers[24:], x]
    bm25 = [x, *bm25_fillers[:24], m, *bm25_fillers[24:], y]

    fused = _fuse_rankings([dense, bm25], limit=10)

    top_ids = [chunk.source_id for chunk in fused]
    assert "X" in top_ids
    assert "Y" in top_ids
    assert top_ids.index("X") < top_ids.index("M")
    assert top_ids.index("Y") < top_ids.index("M")


def test_rrf_returns_non_decreasing_distance():
    chunks = [make_chunk(f"C{i}") for i in range(10)]
    dense = list(chunks)
    bm25 = list(reversed(chunks))

    fused = _fuse_rankings([dense, bm25], limit=10)

    distances = [chunk.distance for chunk in fused]
    assert distances == sorted(distances)


class _OneAtATimeSession:
    """Models SQLAlchemy's AsyncSession contract: a session runs one operation at a time.

    Real sessions raise "This session is provisioning a new connection; concurrent operations
    are not permitted" when two queries start together on a fresh session. Here we record the
    overlap instead so the test can assert on it.
    """

    def begin_nested(self):
        # The full-text query runs inside a SAVEPOINT; a no-op context manager is enough here.
        class _Savepoint:
            async def __aenter__(self_inner):
                return self_inner

            async def __aexit__(self_inner, *_exc):
                return False

        return _Savepoint()

    def __init__(self) -> None:
        self.in_flight = 0
        self.max_in_flight = 0
        self.statements = 0

    async def execute(self, *_args, **_kwargs):
        import asyncio

        self.in_flight += 1
        self.max_in_flight = max(self.max_in_flight, self.in_flight)
        self.statements += 1
        await asyncio.sleep(0)  # yield, as a real driver round trip would
        self.in_flight -= 1

        class _Empty:
            def all(self):
                return []

        return _Empty()


async def test_hybrid_retrieval_never_overlaps_queries_on_one_session():
    # Running dense and full-text search with asyncio.gather on the request's single session made
    # the second query fail; retrieve_bm25_chunks swallows errors, so hybrid search silently
    # became dense-only.
    from app.services.retrieval import retrieve_hybrid_chunks

    session = _OneAtATimeSession()

    await retrieve_hybrid_chunks(session, "choroideremia gene therapy", [0.0] * 3, limit=10)

    assert session.statements == 2  # both searches ran
    assert session.max_in_flight == 1


async def test_failed_fulltext_query_does_not_poison_the_session(monkeypatch):
    # On PostgreSQL a failed statement aborts the whole transaction. retrieve_bm25_chunks swallows
    # its errors so hybrid search can fall back to dense-only, which is only true if the session
    # stays usable afterwards: the next query in the same Ask request (CHM filter, explicit NCT
    # lookups, source enrichment) must still work. Needs the local database; skipped without it.
    import pytest
    from sqlalchemy import text as real_text

    from app.db import AsyncSessionLocal, check_database_connectivity
    from app.services import retrieval

    if not await check_database_connectivity():
        pytest.skip("Database is unavailable.")

    from app.db import engine

    try:
        async with AsyncSessionLocal() as session:
            monkeypatch.setattr(retrieval, "text", lambda *_a, **_k: real_text("SELECT * FROM no_such_table_xyz"))
            assert await retrieval.retrieve_bm25_chunks(session, "choroideremia") == []
            monkeypatch.undo()

            # Before the fix this raised InFailedSQLTransactionError ("current transaction is aborted").
            assert (await session.execute(real_text("SELECT 1"))).scalar() == 1
    finally:
        # pytest-asyncio gives each test its own event loop; a pooled connection made in this one
        # would break the next test that touches the shared engine ("attached to a different loop").
        await engine.dispose()
