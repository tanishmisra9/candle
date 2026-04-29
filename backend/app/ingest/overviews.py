from __future__ import annotations

import argparse
import asyncio
import logging

from sqlalchemy import func, select

from app.db import AsyncSessionLocal
from app.models import Publication
from app.services.publication_overviews import get_or_generate_publication_overview


logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("candle.overviews")
OVERVIEW_PAGE_SIZE = 100


async def generate_publication_overviews(*, force: bool = False) -> int:
    async with AsyncSessionLocal() as session:
        total_publications = await session.scalar(select(func.count()).select_from(Publication))
        total_publications = total_publications or 0
        generated_count = 0
        processed_count = 0
        last_pmid: str | None = None

        while True:
            stmt = select(Publication).order_by(Publication.pmid.asc()).limit(OVERVIEW_PAGE_SIZE)
            if last_pmid is not None:
                stmt = stmt.where(Publication.pmid > last_pmid)

            publications = (await session.execute(stmt)).scalars().all()
            if not publications:
                break

            for publication in publications:
                current_publication = await session.get(Publication, publication.pmid)
                if current_publication is None:
                    continue

                _overview, generated = await get_or_generate_publication_overview(
                    session, current_publication, force=force
                )
                if generated:
                    generated_count += 1
                processed_count += 1

                if processed_count % 25 == 0 or processed_count == total_publications:
                    logger.info(
                        "Processed %s/%s publications (%s generated)",
                        processed_count,
                        total_publications,
                        generated_count,
                    )

            last_pmid = publications[-1].pmid

    return generated_count


async def main(force: bool = False) -> None:
    logger.info("Generating publication overviews...")
    generated_count = await generate_publication_overviews(force=force)
    logger.info("✓ %s publication overviews generated or refreshed", generated_count)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--force",
        action="store_true",
        help="Regenerate all publication overviews, even if a cached version already exists.",
    )
    args = parser.parse_args()
    asyncio.run(main(force=args.force))
