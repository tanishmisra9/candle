from __future__ import annotations

import re

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Publication, Trial


TRIAL_PATTERN = re.compile(r"NCT\d{8}", re.IGNORECASE)


async def link_publications_to_trials(session: AsyncSession) -> int:
    trial_ids = {
        trial_id
        for trial_id in (
            await session.scalars(select(Trial.id))
        ).all()
    }

    publications = (
        await session.execute(select(Publication.pmid, Publication.title, Publication.abstract))
    ).all()

    linked_count = 0
    await session.execute(update(Publication).values(trial_id=None))

    for pmid, title, abstract in publications:
        haystack = f"{title or ''}\n{abstract or ''}"
        matches = [match.upper() for match in TRIAL_PATTERN.findall(haystack)]
        linked_trial_id = next((match for match in matches if match in trial_ids), None)
        if linked_trial_id:
            await session.execute(
                update(Publication)
                .where(Publication.pmid == pmid)
                .values(trial_id=linked_trial_id)
            )
            linked_count += 1

    await session.commit()
    return linked_count
