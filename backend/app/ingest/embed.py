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


STATUS_LABELS = {
    "RECRUITING": "Recruiting",
    "NOT_YET_RECRUITING": "Not yet recruiting",
    "ENROLLING_BY_INVITATION": "Enrolling by invitation",
    "ACTIVE_NOT_RECRUITING": "Active, not recruiting",
    "COMPLETED": "Completed",
    "TERMINATED": "Terminated",
    "WITHDRAWN": "Withdrawn",
    "SUSPENDED": "Suspended",
}

PHASE_LABELS = {
    "PHASE1": "Phase 1",
    "PHASE2": "Phase 2",
    "PHASE3": "Phase 3",
    "PHASE4": "Phase 4",
    "EARLY_PHASE1": "Early Phase 1",
    "NA": "Not Applicable",
}


def prettify_status(status: str | None) -> str | None:
    if not status:
        return None
    normalized = status.strip().upper()
    return STATUS_LABELS.get(normalized) or status.strip().replace("_", " ").capitalize()


def prettify_phase(phase: str | None) -> str | None:
    if not phase:
        return None
    parts = [part.strip().upper() for part in phase.split("/") if part.strip()]
    if not parts:
        return None
    return "/".join(PHASE_LABELS.get(part, part.replace("_", " ").title()) for part in parts)


def extract_study_type(trial: Trial) -> str | None:
    raw = trial.raw_json or {}
    protocol = raw.get("protocolSection") or {}
    design_module = protocol.get("designModule") or {}
    study_type = design_module.get("studyType")
    if not isinstance(study_type, str) or not study_type.strip():
        return None
    return study_type.strip().capitalize()


def format_intervention_types(trial: Trial) -> str | None:
    raw = trial.raw_json or {}
    protocol = raw.get("protocolSection") or {}
    arms_module = protocol.get("armsInterventionsModule") or {}
    interventions = arms_module.get("interventions") or []
    types: list[str] = []
    for item in interventions:
        if not isinstance(item, dict):
            continue
        value = item.get("type")
        if isinstance(value, str) and value.strip():
            label = value.strip().capitalize()
            if label not in types:
                types.append(label)
    if types:
        return ", ".join(types)

    if trial.intervention_type:
        fallback = [
            part.strip().capitalize()
            for part in trial.intervention_type.split("/")
            if part.strip()
        ]
        if fallback:
            return ", ".join(dict.fromkeys(fallback))
    return None


def build_trial_chunk(trial: Trial) -> str:
    lines = [f"Title: {trial.title}", f"NCT ID: {trial.id}"]

    status = prettify_status(trial.status)
    if status:
        lines.append(f"Status: {status}")

    phase = prettify_phase(trial.phase)
    if phase:
        lines.append(f"Phase: {phase}")

    study_type = extract_study_type(trial)
    if study_type:
        lines.append(f"Study Type: {study_type}")

    intervention_types = format_intervention_types(trial)
    if intervention_types:
        lines.append(f"Intervention Type: {intervention_types}")

    if trial.intervention:
        lines.append(f"Intervention: {trial.intervention}")

    if trial.primary_endpoint:
        lines.append(f"Primary Endpoint: {trial.primary_endpoint}")

    if trial.enrollment is not None:
        lines.append(f"Enrollment: {trial.enrollment} participants")

    if trial.sponsor:
        lines.append(f"Sponsor: {trial.sponsor}")

    return "\n".join(lines)


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
