from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date
from typing import Any

import tiktoken
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Embedding, Publication, Trial
from app.config import get_settings
from app.services.embeddings import embed_texts


MAX_BATCH_SIZE = 100
MAX_TOKENS = 500
MIN_TOKENS = 300
CHARS_PER_TOKEN = 4
SOURCE_PAGE_SIZE = 100


@dataclass
class ChunkRecord:
    source_type: str
    source_id: str
    content: str
    metadata: dict[str, Any]


def get_encoding(model_name: str):
    try:
        return tiktoken.encoding_for_model(model_name)
    except KeyError:
        return tiktoken.get_encoding("cl100k_base")


def token_count(encoding, text: str) -> int:
    return len(encoding.encode(text))


def split_long_paragraph(paragraph: str) -> list[str]:
    chunk_chars = MAX_TOKENS * CHARS_PER_TOKEN
    return [
        paragraph[index : index + chunk_chars].strip()
        for index in range(0, len(paragraph), chunk_chars)
        if paragraph[index : index + chunk_chars].strip()
    ]


def chunk_publication_text(title: str, abstract: str | None, encoding) -> list[str]:
    if not abstract:
        return [title]

    combined = f"{title}\n\n{abstract}".strip()
    if token_count(encoding, combined) <= MAX_TOKENS:
        return [combined]

    paragraphs = [part.strip() for part in re.split(r"\n\s*\n", abstract) if part.strip()]
    prepared: list[str] = []
    for paragraph in paragraphs:
        if token_count(encoding, paragraph) > MAX_TOKENS:
            prepared.extend(split_long_paragraph(paragraph))
        else:
            prepared.append(paragraph)

    chunks: list[str] = []
    current: list[str] = []
    current_tokens = 0
    for paragraph in prepared:
        paragraph_tokens = token_count(encoding, paragraph)
        if current and current_tokens + paragraph_tokens > MAX_TOKENS:
            chunks.append(f"{title}\n\n" + "\n\n".join(current))
            current = [paragraph]
            current_tokens = paragraph_tokens
            continue

        current.append(paragraph)
        current_tokens += paragraph_tokens
        if current_tokens >= MIN_TOKENS:
            chunks.append(f"{title}\n\n" + "\n\n".join(current))
            current = []
            current_tokens = 0

    if current:
        chunks.append(f"{title}\n\n" + "\n\n".join(current))

    return chunks or [combined]


def format_date(value: date | None) -> str | None:
    return value.isoformat() if value else None


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


async def latest_embedding_timestamps(
    session: AsyncSession, source_type: str
) -> dict[str, Any]:
    result = await session.execute(
        select(Embedding.source_id, func.max(Embedding.created_at))
        .where(Embedding.source_type == source_type)
        .group_by(Embedding.source_id)
    )
    return {source_id: created_at for source_id, created_at in result.all()}


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


def build_publication_records(
    publications: list[Publication], encoding
) -> list[ChunkRecord]:
    records: list[ChunkRecord] = []
    for publication in publications:
        for content in chunk_publication_text(publication.title, publication.abstract, encoding):
            records.append(
                ChunkRecord(
                    source_type="publication",
                    source_id=publication.pmid,
                    content=content,
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
        vectors = await embed_texts([chunk.content for chunk in batch])
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


async def changed_trial_page(
    session: AsyncSession,
    latest_timestamps: dict[str, Any],
    *,
    last_id: str | None,
) -> tuple[list[Trial], str | None]:
    stmt = select(Trial).order_by(Trial.id.asc()).limit(SOURCE_PAGE_SIZE)
    if last_id is not None:
        stmt = stmt.where(Trial.id > last_id)

    page = (await session.execute(stmt)).scalars().all()
    changed = [
        trial
        for trial in page
        if needs_embedding_refresh(trial.updated_at, latest_timestamps.get(trial.id))
    ]
    next_last_id = page[-1].id if page else None
    return changed, next_last_id


async def changed_publication_page(
    session: AsyncSession,
    latest_timestamps: dict[str, Any],
    *,
    last_pmid: str | None,
) -> tuple[list[Publication], str | None]:
    stmt = select(Publication).order_by(Publication.pmid.asc()).limit(SOURCE_PAGE_SIZE)
    if last_pmid is not None:
        stmt = stmt.where(Publication.pmid > last_pmid)

    page = (await session.execute(stmt)).scalars().all()
    changed = [
        publication
        for publication in page
        if needs_embedding_refresh(
            publication.updated_at,
            latest_timestamps.get(publication.pmid),
        )
    ]
    next_last_pmid = page[-1].pmid if page else None
    return changed, next_last_pmid


async def store_embeddings(session: AsyncSession) -> int:
    settings_model_name = get_settings().embedding_model
    encoding = get_encoding(settings_model_name)
    stored_count = 0

    trial_timestamps = await latest_embedding_timestamps(session, "trial")
    last_trial_id: str | None = None
    while True:
        changed_trials, last_trial_id = await changed_trial_page(
            session,
            trial_timestamps,
            last_id=last_trial_id,
        )
        if last_trial_id is None:
            break
        stored_count += await store_chunk_records(
            session,
            build_trial_records(changed_trials),
        )

    publication_timestamps = await latest_embedding_timestamps(session, "publication")
    last_publication_pmid: str | None = None
    while True:
        changed_publications, last_publication_pmid = await changed_publication_page(
            session,
            publication_timestamps,
            last_pmid=last_publication_pmid,
        )
        if last_publication_pmid is None:
            break
        stored_count += await store_chunk_records(
            session,
            build_publication_records(changed_publications, encoding),
        )

    return stored_count
