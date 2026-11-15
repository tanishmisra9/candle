"""Hybrid retrieval over the `embeddings` table.

Dense pgvector cosine search (on the request's session) and Postgres full-text search (`ts_rank_cd`
over the generated `content_tsv`, on its OWN short-lived session, because one session cannot run two
queries at once) run concurrently and are fused with Reciprocal Rank Fusion (`RRF_K = 60`), one entry per (source_type, source_id). `RetrievedChunk.distance` is lower-is-better in all paths.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import AsyncSessionLocal
from app.models import Embedding


logger = logging.getLogger("candle.api")

RRF_K = 60


@dataclass
class RetrievedChunk:
    source_type: str
    source_id: str
    content: str
    title: str
    url: str | None
    metadata: dict[str, Any]
    distance: float


async def retrieve_similar_chunks(
    session: AsyncSession,
    query_embedding: list[float],
    limit: int = 6,
    source_type: str | None = None,
) -> list[RetrievedChunk]:
    """Dense nearest-neighbour search by pgvector cosine distance."""
    distance = Embedding.embedding.cosine_distance(query_embedding)
    stmt = (
        select(
            Embedding.source_type,
            Embedding.source_id,
            Embedding.content,
            Embedding.chunk_metadata,
            distance.label("distance"),
        )
    )
    if source_type:
        stmt = stmt.where(Embedding.source_type == source_type)
    stmt = stmt.order_by(distance).limit(limit)
    result = await session.execute(stmt)

    rows = []
    for source_type, source_id, content, metadata, chunk_distance in result.all():
        metadata = metadata or {}
        rows.append(
            RetrievedChunk(
                source_type=source_type,
                source_id=source_id,
                content=content,
                title=metadata.get("title") or source_id,
                url=metadata.get("url"),
                metadata=metadata,
                distance=float(chunk_distance),
            )
        )
    return rows


async def retrieve_bm25_chunks(
    session: AsyncSession,
    query: str,
    limit: int = 50,
    source_type: str | None = None,
) -> list[RetrievedChunk]:
    """Full-text search (`websearch_to_tsquery`, `ts_rank_cd`). Returns [] on empty input or any database error (rolled back to a savepoint, so the session stays usable) and hybrid search degrades to dense-only."""
    if not query or not query.strip():
        return []

    stmt = text(
        """
        SELECT
            e.source_type,
            e.source_id,
            e.content,
            e.metadata,
            ts_rank_cd(e.content_tsv, q) AS rank
        FROM embeddings e, websearch_to_tsquery('english', :query) q
        WHERE e.content_tsv @@ q
          AND (CAST(:source_type AS text) IS NULL OR e.source_type = CAST(:source_type AS text))
        ORDER BY rank DESC
        LIMIT :limit
        """
    )

    try:
        # A SAVEPOINT, not the bare session: on PostgreSQL a failed statement aborts the whole
        # transaction, so without it swallowing the error below would leave the request's session
        # unusable and the very next query (CHM filter, NCT lookups, source enrichment) would fail
        # with "current transaction is aborted". The savepoint rolls back only this query.
        async with session.begin_nested():
            result = await session.execute(
                stmt,
                {"query": query, "source_type": source_type, "limit": limit},
            )
            fetched = result.all()
    except Exception:
        logger.warning("Full-text search failed; continuing with dense results only", exc_info=True)
        return []

    rows: list[RetrievedChunk] = []
    for source_type_value, source_id, content, metadata, rank in fetched:
        metadata = metadata or {}
        rows.append(
            RetrievedChunk(
                source_type=source_type_value,
                source_id=source_id,
                content=content,
                title=metadata.get("title") or source_id,
                url=metadata.get("url"),
                metadata=metadata,
                distance=1.0 - float(rank),
            )
        )
    return rows


def _fuse_rankings(
    ranked_lists: list[list[RetrievedChunk]],
    limit: int,
) -> list[RetrievedChunk]:
    """Reciprocal Rank Fusion across ranked lists, one entry per source, with scores rescaled into `distance` (0 best)."""
    fused_scores: dict[tuple[str, str], float] = {}
    best_chunk: dict[tuple[str, str], RetrievedChunk] = {}

    for ranked in ranked_lists:
        for rank, chunk in enumerate(ranked):
            key = (chunk.source_type, chunk.source_id)
            fused_scores[key] = fused_scores.get(key, 0.0) + 1.0 / (RRF_K + rank + 1)
            if key not in best_chunk:
                best_chunk[key] = chunk

    if not fused_scores:
        return []

    ordered_keys = sorted(fused_scores, key=lambda key: fused_scores[key], reverse=True)[:limit]

    scores = [fused_scores[key] for key in ordered_keys]
    max_score = max(scores)
    min_score = min(scores)
    span = max_score - min_score

    fused: list[RetrievedChunk] = []
    for key in ordered_keys:
        chunk = best_chunk[key]
        if span > 0:
            normalized = (fused_scores[key] - min_score) / span
        else:
            normalized = 1.0
        chunk.distance = 1.0 - normalized
        fused.append(chunk)
    return fused


async def retrieve_hybrid_chunks(
    session: AsyncSession,
    query: str,
    embedding: list[float],
    limit: int = 50,
    source_type: str | None = None,
    bm25_session_factory: Callable[[], Any] = AsyncSessionLocal,
) -> list[RetrievedChunk]:
    """Run dense and full-text retrieval (each capped at 50) concurrently and fuse them.

    The two queries cannot share one AsyncSession (it runs one operation at a time: running both with
    asyncio.gather on the request's session made the second one fail, which hybrid search then
    swallowed and silently became dense-only). So the dense query uses `session` and the full-text
    query gets its own short-lived session from `bm25_session_factory`. Any failure of the full-text
    side, including not getting a connection, degrades to dense-only.
    """
    capped_limit = min(limit, 50)

    async def full_text() -> list[RetrievedChunk]:
        try:
            async with bm25_session_factory() as own_session:
                return await retrieve_bm25_chunks(
                    own_session, query, limit=capped_limit, source_type=source_type
                )
        except Exception:
            logger.warning("Full-text search unavailable; continuing with dense results only", exc_info=True)
            return []

    bm25_task = asyncio.create_task(full_text())
    try:
        dense = await retrieve_similar_chunks(
            session, embedding, limit=capped_limit, source_type=source_type
        )
    except BaseException:
        # Do not leave the sibling query running after the request has failed, and wait for it to
        # unwind so its session is closed (its connection returned) before we propagate.
        bm25_task.cancel()
        await asyncio.gather(bm25_task, return_exceptions=True)
        raise
    bm25 = await bm25_task
    return _fuse_rankings([dense, bm25], capped_limit)
