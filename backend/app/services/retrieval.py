from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Embedding


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
