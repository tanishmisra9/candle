from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date
from typing import Any

import tiktoken
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Embedding, Publication, Trial
from app.config import get_settings
from app.services.embeddings import embed_texts


MAX_BATCH_SIZE = 100
MAX_TOKENS = 500
MIN_TOKENS = 300
CHARS_PER_TOKEN = 4


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


async def build_chunks(session: AsyncSession) -> list[ChunkRecord]:
    settings_model_name = get_settings().embedding_model
    encoding = get_encoding(settings_model_name)
    chunks: list[ChunkRecord] = []

    trials = (await session.execute(select(Trial))).scalars().all()
    for trial in trials:
        chunks.append(
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

    publications = (await session.execute(select(Publication))).scalars().all()
    for publication in publications:
        for content in chunk_publication_text(
            publication.title, publication.abstract, encoding
        ):
            chunks.append(
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

    return chunks


async def store_embeddings(session: AsyncSession) -> int:
    chunks = await build_chunks(session)
    if not chunks:
        return 0

    trial_ids = sorted({chunk.source_id for chunk in chunks if chunk.source_type == "trial"})
    publication_ids = sorted(
        {chunk.source_id for chunk in chunks if chunk.source_type == "publication"}
    )

    if trial_ids:
        await session.execute(
            delete(Embedding).where(
                Embedding.source_type == "trial", Embedding.source_id.in_(trial_ids)
            )
        )
    if publication_ids:
        await session.execute(
            delete(Embedding).where(
                Embedding.source_type == "publication",
                Embedding.source_id.in_(publication_ids),
            )
        )
    await session.commit()

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
