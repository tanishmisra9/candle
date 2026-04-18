from __future__ import annotations

import argparse
import asyncio
import logging

from sqlalchemy import select

from app.db import AsyncSessionLocal
from app.models import Publication
from app.services.publication_overviews import get_or_generate_publication_overview


logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("candle.overviews")


async def generate_publication_overviews(*, force: bool = False) -> int:
    async with AsyncSessionLocal() as session:
        publications = (
            await session.execute(
                select(Publication).order_by(Publication.pub_date.desc().nullslast())
            )
        ).scalars().all()

    generated_count = 0

    for index, publication in enumerate(publications, start=1):
        async with AsyncSessionLocal() as session:
            current_publication = await session.get(Publication, publication.pmid)
            if current_publication is None:
                continue

            _overview, generated = await get_or_generate_publication_overview(
                session, current_publication, force=force
            )
            if generated:
                generated_count += 1

        if index % 25 == 0 or index == len(publications):
            logger.info(
                "Processed %s/%s publications (%s generated)",
                index,
                len(publications),
                generated_count,
            )

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
