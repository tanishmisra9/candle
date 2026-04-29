from __future__ import annotations

import re

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Publication, Trial


TRIAL_PATTERN = re.compile(r"NCT\d{8}", re.IGNORECASE)
PUBLICATION_PAGE_SIZE = 200


async def link_publications_to_trials(session: AsyncSession) -> int:
    trial_ids = {
        trial_id
        for trial_id in (
            await session.scalars(select(Trial.id))
        ).all()
    }

    linked_count = 0
    last_pmid: str | None = None

    try:
        while True:
            stmt = (
                select(
                    Publication.pmid,
                    Publication.title,
                    Publication.abstract,
                    Publication.trial_id,
                )
                .order_by(Publication.pmid.asc())
                .limit(PUBLICATION_PAGE_SIZE)
            )
            if last_pmid is not None:
                stmt = stmt.where(Publication.pmid > last_pmid)

            publications = (await session.execute(stmt)).all()
            if not publications:
                break

            for pmid, title, abstract, current_trial_id in publications:
                haystack = f"{title or ''}\n{abstract or ''}"
                matches = [match.upper() for match in TRIAL_PATTERN.findall(haystack)]
                linked_trial_id = next((match for match in matches if match in trial_ids), None)
                if linked_trial_id is not None:
                    linked_count += 1

                if linked_trial_id != current_trial_id:
                    await session.execute(
                        update(Publication)
                        .where(Publication.pmid == pmid)
                        .values(trial_id=linked_trial_id)
                    )

                last_pmid = pmid

        await session.commit()
        return linked_count
    except Exception:
        await session.rollback()
        raise
