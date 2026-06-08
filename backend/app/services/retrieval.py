from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Embedding


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
          AND (:source_type IS NULL OR e.source_type = :source_type)
        ORDER BY rank DESC
        LIMIT :limit
        """
    )

    try:
        result = await session.execute(
            stmt,
            {"query": query, "source_type": source_type, "limit": limit},
        )
        fetched = result.all()
    except Exception:
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
) -> list[RetrievedChunk]:
    capped_limit = min(limit, 50)
    dense, bm25 = await asyncio.gather(
        retrieve_similar_chunks(
            session, embedding, limit=capped_limit, source_type=source_type
        ),
        retrieve_bm25_chunks(
            session, query, limit=capped_limit, source_type=source_type
        ),
    )
    return _fuse_rankings([dense, bm25], capped_limit)
