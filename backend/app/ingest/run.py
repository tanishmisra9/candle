from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from app.db import AsyncSessionLocal
from app.ingest.clinicaltrials import ingest_trials
from app.ingest.embed import store_embeddings
from app.ingest.link import link_publications_to_trials
from app.ingest.overviews import generate_publication_overviews
from app.ingest.pubmed import ingest_publications
from app.ingest.summarise import generate_trial_summaries
from app.models import SyncLog


logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("candle.ingest")


async def finalize_sync_log(
    sync_log_id: int,
    *,
    status: str,
    trial_count: int,
    publication_count: int,
    linked_count: int,
    embedding_count: int,
    summary_count: int,
    error_message: str | None = None,
) -> None:
    async with AsyncSessionLocal() as session:
        sync_log = await session.get(SyncLog, sync_log_id)
        if sync_log is None:
            return

        sync_log.finished_at = datetime.now(timezone.utc)
        sync_log.trials_ingested = trial_count
        sync_log.publications_ingested = publication_count
        sync_log.publications_linked = linked_count
        sync_log.embeddings_stored = embedding_count
        sync_log.summaries_generated = summary_count
        sync_log.status = status
        sync_log.error_message = error_message
        await session.commit()


async def main() -> None:
    trial_count = 0
    publication_count = 0
    linked_count = 0
    overview_count = 0
    embedding_count = 0
    summary_count = 0

    async with AsyncSessionLocal() as session:
        sync_log = SyncLog(status="running")
        session.add(sync_log)
        await session.commit()
        await session.refresh(sync_log)

    try:
        logger.info("Ingesting ClinicalTrials.gov studies...")
        async with AsyncSessionLocal() as session:
            trial_count = await ingest_trials(session)

        logger.info("Ingesting PubMed publications...")
        async with AsyncSessionLocal() as session:
            publication_count = await ingest_publications(session)

        logger.info("Linking publications to trials...")
        async with AsyncSessionLocal() as session:
            linked_count = await link_publications_to_trials(session)

        logger.info("Generating publication overviews...")
        overview_count = await generate_publication_overviews()

        logger.info("Embedding trials and publications...")
        async with AsyncSessionLocal() as session:
            embedding_count = await store_embeddings(session)

        logger.info("Generating AI summaries for trials...")
        async with AsyncSessionLocal() as session:
            summary_count = await generate_trial_summaries(session)
        logger.info("✓ %s trial summaries generated", summary_count)

        await finalize_sync_log(
            sync_log.id,
            status="success",
            trial_count=trial_count,
            publication_count=publication_count,
            linked_count=linked_count,
            embedding_count=embedding_count,
            summary_count=summary_count,
        )
    except Exception as exc:
        await finalize_sync_log(
            sync_log.id,
            status="error",
            trial_count=trial_count,
            publication_count=publication_count,
            linked_count=linked_count,
            embedding_count=embedding_count,
            summary_count=summary_count,
            error_message=str(exc),
        )
        raise

    logger.info("✓ %s trials ingested", trial_count)
    logger.info("✓ %s publications ingested", publication_count)
    logger.info("✓ %s publications linked to trials", linked_count)
    logger.info("✓ %s publication overviews generated", overview_count)
    logger.info("✓ %s embeddings stored", embedding_count)
    logger.info("Done.")


if __name__ == "__main__":
    asyncio.run(main())
