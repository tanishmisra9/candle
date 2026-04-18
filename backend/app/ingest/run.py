from __future__ import annotations

import asyncio
import logging

from app.db import AsyncSessionLocal
from app.ingest.clinicaltrials import ingest_trials
from app.ingest.embed import store_embeddings
from app.ingest.link import link_publications_to_trials
from app.ingest.overviews import generate_publication_overviews
from app.ingest.pubmed import ingest_publications


logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("candle.ingest")


async def main() -> None:
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

    logger.info("✓ %s trials ingested", trial_count)
    logger.info("✓ %s publications ingested", publication_count)
    logger.info("✓ %s publications linked to trials", linked_count)
    logger.info("✓ %s publication overviews generated", overview_count)
    logger.info("✓ %s embeddings stored", embedding_count)
    logger.info("Done.")


if __name__ == "__main__":
    asyncio.run(main())
