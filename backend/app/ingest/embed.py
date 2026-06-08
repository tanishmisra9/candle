from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any

from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Embedding, Publication, Trial
from app.config import get_settings
from app.services.embeddings import embed_texts


MAX_BATCH_SIZE = 512
SOURCE_PAGE_SIZE = 100


@dataclass
class ChunkRecord:
    source_type: str
    source_id: str
    content: str
    metadata: dict[str, Any]


def format_date(value: date | None) -> str | None:
    return value.isoformat() if value else None


def format_authors(authors: list[str]) -> str:
    if not authors:
        return "Unknown"
    lead_authors = [author.split(",")[0].strip() for author in authors[:3] if author.strip()]
    if len(authors) > 3:
        return ", ".join(lead_authors) + " et al."
    return ", ".join(lead_authors)


def build_publication_chunk(publication: Publication) -> str:
    year = str(publication.pub_date.year) if publication.pub_date else "Unknown"
    abstract = publication.abstract or "No abstract available."
    return (
        f"Title: {publication.title}\n"
        f"Abstract: {abstract}\n"
        f"Journal: {publication.journal or 'Unknown'}\n"
        f"Year: {year}\n"
        f"Authors: {format_authors(publication.authors)}\n"
        f"PMID: {publication.pmid}"
    )


def build_trial_chunk(trial: Trial) -> str:
    enrollment = f"{trial.enrollment} patients" if trial.enrollment is not None else "Unknown"
    return (
        f"Title: {trial.title}\n"
        f"Status: {trial.status or 'Unknown'} | Phase: {trial.phase or 'Unknown'} | "
        f"Intervention: {trial.intervention or 'Unknown'}\n"
        f"Primary Endpoint: {trial.primary_endpoint or 'Unknown'}\n"
        f"Enrollment: {enrollment}\n"
        f"Sponsor: {trial.sponsor or 'Unknown'}"
    )


def needs_embedding_refresh(updated_at, embedded_at) -> bool:
    return embedded_at is None or updated_at is None or updated_at > embedded_at


def latest_embedding_subquery(source_type: str):
    return (
        select(
            Embedding.source_id.label("source_id"),
            func.max(Embedding.created_at).label("embedded_at"),
        )
        .where(Embedding.source_type == source_type)
        .group_by(Embedding.source_id)
        .subquery()
    )


def build_trial_records(trials: list[Trial]) -> list[ChunkRecord]:
    records: list[ChunkRecord] = []
    for trial in trials:
        records.append(
            ChunkRecord(
                source_type="trial",
                source_id=trial.id,
                content=build_trial_chunk(trial),
                metadata={
                    "title": trial.title,
                    "url": trial.url,
                    "status": trial.status,
                    "phase": trial.phase,
                    "sponsor": trial.sponsor,
                },
            )
        )
    return records


def build_publication_records(publications: list[Publication]) -> list[ChunkRecord]:
    records: list[ChunkRecord] = []
    for publication in publications:
        records.append(
            ChunkRecord(
                source_type="publication",
                source_id=publication.pmid,
                content=build_publication_chunk(publication),
                metadata={
                    "title": publication.title,
                    "url": publication.url,
                    "pub_date": format_date(publication.pub_date),
                    "journal": publication.journal,
                },
            )
        )
    return records


async def store_chunk_records(session: AsyncSession, chunks: list[ChunkRecord]) -> int:
    if not chunks:
        return 0

    settings = get_settings()
    source_type = chunks[0].source_type
    source_ids = sorted({chunk.source_id for chunk in chunks})
    await session.execute(
        delete(Embedding).where(
            Embedding.source_type == source_type,
            Embedding.source_id.in_(source_ids),
        )
    )

    rows: list[Embedding] = []
    for batch_index in range(0, len(chunks), MAX_BATCH_SIZE):
        batch = chunks[batch_index : batch_index + MAX_BATCH_SIZE]
        vectors = await embed_texts(
            [chunk.content for chunk in batch],
            retries=settings.background_openai_max_retries,
            retry_backoff_seconds=settings.background_openai_retry_backoff_seconds,
        )
        for chunk, vector in zip(batch, vectors, strict=True):
            rows.append(
                Embedding(
                    source_type=chunk.source_type,
                    source_id=chunk.source_id,
                    content=chunk.content,
                    chunk_metadata=chunk.metadata,
                    embedding=vector,
                )
            )
    session.add_all(rows)
    await session.commit()
    return len(rows)


def _needs_refresh_clause(embedded_at_column):
    return or_(
        embedded_at_column.is_(None),
        Trial.updated_at.is_(None),
        Trial.updated_at > embedded_at_column,
    )


async def changed_trial_page(
    session: AsyncSession,
    *,
    last_id: str | None,
) -> tuple[list[Trial], str | None]:
    latest = latest_embedding_subquery("trial")
    stmt = (
        select(Trial)
        .outerjoin(latest, Trial.id == latest.c.source_id)
        .where(_needs_refresh_clause(latest.c.embedded_at))
        .order_by(Trial.id.asc())
        .limit(SOURCE_PAGE_SIZE)
    )
    if last_id is not None:
        stmt = stmt.where(Trial.id > last_id)

    page = (await session.execute(stmt)).scalars().all()
    next_last_id = page[-1].id if page else None
    return page, next_last_id


async def changed_publication_page(
    session: AsyncSession,
    *,
    last_pmid: str | None,
) -> tuple[list[Publication], str | None]:
    latest = latest_embedding_subquery("publication")
    stmt = (
        select(Publication)
        .outerjoin(latest, Publication.pmid == latest.c.source_id)
        .where(
            or_(
                latest.c.embedded_at.is_(None),
                Publication.updated_at.is_(None),
                Publication.updated_at > latest.c.embedded_at,
            )
        )
        .order_by(Publication.pmid.asc())
        .limit(SOURCE_PAGE_SIZE)
    )
    if last_pmid is not None:
        stmt = stmt.where(Publication.pmid > last_pmid)

    page = (await session.execute(stmt)).scalars().all()
    next_last_pmid = page[-1].pmid if page else None
    return page, next_last_pmid


async def store_embeddings(session: AsyncSession) -> int:
    stored_count = 0

    last_trial_id: str | None = None
    while True:
        changed_trials, last_trial_id = await changed_trial_page(
            session,
            last_id=last_trial_id,
        )
        if last_trial_id is None:
            break
        stored_count += await store_chunk_records(
            session,
            build_trial_records(changed_trials),
        )

    last_publication_pmid: str | None = None
    while True:
        changed_publications, last_publication_pmid = await changed_publication_page(
            session,
            last_pmid=last_publication_pmid,
        )
        if last_publication_pmid is None:
            break
        stored_count += await store_chunk_records(
            session,
            build_publication_records(changed_publications),
        )

    return stored_count
