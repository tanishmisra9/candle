from __future__ import annotations

import hashlib

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import text

from app.config import get_settings
from app.models import Publication
from app.services.embeddings import get_openai_client
from app.services.openai_executor import run_openai_operation


PUBLICATION_OVERVIEW_PROMPT_VERSION = "v2"

PUBLICATION_OVERVIEW_SYSTEM_PROMPT = """You are a plain-language science communicator helping patients and families understand medical research about Choroideremia (CHM), a rare inherited retinal disease.

Given a research abstract, write a short 2-3 sentence overview that:
- Explains what the researchers wanted to learn
- Briefly says what they did or tested
- States the main takeaway in simple, everyday language

Use very plain language, short sentences, and a warm tone. Avoid jargon whenever possible; if a technical term is truly necessary, explain it briefly. Focus on what a patient or family member would want to understand most.

Do not begin with "This study" or "The study". Output only the overview — no preamble, no labels, no quotation marks."""


def get_publication_overview_abstract_hash(abstract: str) -> str:
    return hashlib.sha256(abstract.encode("utf-8")).hexdigest()


async def get_cached_publication_overview(
    session: AsyncSession, pmid: str, abstract_hash: str
) -> str | None:
    result = await session.execute(
        text(
            """
            SELECT overview
            FROM publication_overviews
            WHERE pmid = :pmid
              AND abstract_hash = :abstract_hash
              AND prompt_version = :prompt_version
            """
        ),
        {
            "pmid": pmid,
            "abstract_hash": abstract_hash,
            "prompt_version": PUBLICATION_OVERVIEW_PROMPT_VERSION,
        },
    )
    overview = result.scalar_one_or_none()
    if isinstance(overview, str):
        normalized = overview.strip()
        return normalized or None
    return None


async def store_publication_overview(
    session: AsyncSession, pmid: str, abstract_hash: str, overview: str
) -> None:
    await session.execute(
        text(
            """
            INSERT INTO publication_overviews (pmid, overview, abstract_hash, prompt_version)
            VALUES (:pmid, :overview, :abstract_hash, :prompt_version)
            ON CONFLICT (pmid)
            DO UPDATE SET
                overview = EXCLUDED.overview,
                abstract_hash = EXCLUDED.abstract_hash,
                prompt_version = EXCLUDED.prompt_version,
                updated_at = NOW()
            """
        ),
        {
            "pmid": pmid,
            "overview": overview,
            "abstract_hash": abstract_hash,
            "prompt_version": PUBLICATION_OVERVIEW_PROMPT_VERSION,
        },
    )
    await session.commit()


async def generate_publication_overview_text(abstract: str) -> str | None:
    settings = get_settings()
    if not settings.openai_api_key:
        raise RuntimeError(
            "OPENAI_API_KEY is required for publication overview generation."
        )

    response = await run_openai_operation(
        lambda: get_openai_client().chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.2,
            messages=[
                {"role": "system", "content": PUBLICATION_OVERVIEW_SYSTEM_PROMPT},
                {"role": "user", "content": abstract},
            ],
        ),
        timeout_seconds=settings.publication_overview_timeout_seconds,
    )
    return (response.choices[0].message.content or "").strip() or None


async def get_or_generate_publication_overview(
    session: AsyncSession, publication: Publication, *, force: bool = False
) -> tuple[str | None, bool]:
    abstract = (publication.abstract or "").strip()
    if not abstract:
        return None, False

    abstract_hash = get_publication_overview_abstract_hash(abstract)

    if not force:
        cached_overview = await get_cached_publication_overview(
            session, publication.pmid, abstract_hash
        )
        if cached_overview is not None:
            return cached_overview, False

    overview = await generate_publication_overview_text(abstract)
    if overview is not None:
        await store_publication_overview(session, publication.pmid, abstract_hash, overview)
    return overview, True
