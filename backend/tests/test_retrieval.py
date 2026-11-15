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
    """A session that, like a real AsyncSession, must never run two statements at once.

    Real sessions raise "This session is provisioning a new connection; concurrent operations
    are not permitted" when two queries start together. Here we record the overlap instead so the
    test can assert on it.
    """

    def __init__(self) -> None:
        self.in_flight = 0
        self.max_in_flight = 0
        self.statements = 0

    def begin_nested(self):
        # The full-text query runs inside a SAVEPOINT; a no-op context manager is enough here.
        class _Savepoint:
            async def __aenter__(self_inner):
                return self_inner

            async def __aexit__(self_inner, *_exc):
                return False

        return _Savepoint()

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_exc):
        return False

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


async def test_hybrid_retrieval_runs_each_query_on_its_own_session():
    # Dense and full-text run concurrently, but never on the same session: one AsyncSession cannot run
    # two statements at once (gathering both on the request's session made the second fail, and the
    # swallowed error silently made search dense-only).
    from app.services.retrieval import retrieve_hybrid_chunks

    request_session = _OneAtATimeSession()
    own_session = _OneAtATimeSession()

    await retrieve_hybrid_chunks(
        request_session,
        "choroideremia gene therapy",
        [0.0] * 3,
        limit=10,
        bm25_session_factory=lambda: own_session,
    )

    assert request_session.statements == 1 and own_session.statements == 1  # both searches ran, apart
    assert request_session.max_in_flight == 1
    assert own_session.max_in_flight == 1


async def test_hybrid_retrieval_degrades_to_dense_when_the_fulltext_session_cannot_start():
    from app.services.retrieval import retrieve_hybrid_chunks

    def broken_factory():
        raise ConnectionError("pool exhausted")

    request_session = _OneAtATimeSession()
    result = await retrieve_hybrid_chunks(
        request_session, "q", [0.0] * 3, limit=10, bm25_session_factory=broken_factory
    )

    assert result == []  # dense returned nothing here; the point is that it did not raise
    assert request_session.statements == 1


async def test_hybrid_retrieval_does_not_wait_on_a_fulltext_side_stuck_waiting_for_a_connection(monkeypatch):
    # Under load the full-text query's own pooled connection can take up to the pool timeout (30s by
    # default) to arrive. The dense results were ready, but the request blocked on `await bm25_task`:
    # latency instead of the "degrades to dense-only" the function promises.
    import asyncio

    from app.services import retrieval

    class _StuckWaitingForAConnection:
        cancelled = False

        async def __aenter__(self):
            try:
                await asyncio.sleep(30)
            except asyncio.CancelledError:
                _StuckWaitingForAConnection.cancelled = True
                raise

        async def __aexit__(self, *_exc):
            return False

    monkeypatch.setattr(retrieval, "FULL_TEXT_TIMEOUT_SECONDS", 0.05)
    request_session = _OneAtATimeSession()

    # wait_for turns a regression (waiting out the 30s) into a failure instead of a hung test.
    result = await asyncio.wait_for(
        retrieval.retrieve_hybrid_chunks(
            request_session, "q", [0.0] * 3, limit=10, bm25_session_factory=_StuckWaitingForAConnection
        ),
        timeout=2,
    )

    assert result == []  # dense ran and returned nothing here; the point is that it came back at all
    assert request_session.statements == 1
    assert _StuckWaitingForAConnection.cancelled  # the stuck task was cancelled, not abandoned


async def test_hybrid_retrieval_cancels_the_fulltext_query_when_the_dense_query_fails():
    import asyncio

    from app.services.retrieval import retrieve_hybrid_chunks

    class _Slow(_OneAtATimeSession):
        cancelled = False
        exited = False

        async def __aexit__(self, *_exc):
            await asyncio.sleep(0)  # closing a session takes a loop turn, as a real one does
            _Slow.exited = True
            return False

        async def execute(self, *_args, **_kwargs):
            try:
                await asyncio.sleep(10)
            except asyncio.CancelledError:
                _Slow.cancelled = True
                raise

    class _Failing(_OneAtATimeSession):
        async def execute(self, *_args, **_kwargs):
            await asyncio.sleep(0.01)  # let the full-text side start first
            raise RuntimeError("dense failed")

    slow = _Slow()
    with __import__("pytest").raises(RuntimeError, match="dense failed"):
        await retrieve_hybrid_chunks(_Failing(), "q", [0.0] * 3, bm25_session_factory=lambda: slow)
    # No extra loop turn here on purpose: the failure must not propagate until the cancelled
    # full-text side has unwound and closed its session (its connection is back in the pool).
    assert _Slow.cancelled
    assert _Slow.exited


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


async def test_fulltext_query_actually_runs_against_postgres_with_and_without_a_source_type():
    # The full-text SQL used `(:source_type IS NULL OR e.source_type = :source_type)`, which asyncpg
    # cannot type ("could not determine data type of parameter $2"). The error was swallowed, so the
    # full-text half of hybrid search silently returned nothing, with or without a source type.
    # Needs the local database with indexed embeddings; skipped otherwise.
    import pytest
    from sqlalchemy import text as real_text

    from app.db import AsyncSessionLocal, check_database_connectivity, engine
    from app.services import retrieval

    if not await check_database_connectivity():
        pytest.skip("Database is unavailable.")

    try:
        async with AsyncSessionLocal() as session:
            if not (await session.execute(real_text("SELECT 1 FROM embeddings LIMIT 1"))).first():
                pytest.skip("No embeddings are indexed locally.")
            anywhere = await retrieval.retrieve_bm25_chunks(session, "choroideremia", limit=5)
            only_trials = await retrieval.retrieve_bm25_chunks(session, "choroideremia", limit=5, source_type="trial")
        assert anywhere, "full-text search returned nothing: the query is failing (and being swallowed)"
        assert only_trials and all(chunk.source_type == "trial" for chunk in only_trials)
    finally:
        await engine.dispose()


def test_connection_pool_covers_two_connections_per_concurrent_ask_plus_headroom():
    # Each in-flight Ask holds its request session AND the full-text session. If the pool is smaller
    # than that, checkouts block (30s) and the full-text side silently degrades to dense-only.
    from app.config import get_settings

    settings = get_settings()
    capacity = settings.db_pool_size + settings.db_max_overflow
    assert capacity >= 2 * settings.llm_concurrency_limit + 4
