from __future__ import annotations

import argparse
import asyncio

from sqlalchemy import text

from app.db import AsyncSessionLocal


NON_CHM_WHERE_CLAUSE = """
NOT (raw_json #>> '{protocolSection,conditionsModule,conditions}' ILIKE '%choroideremia%')
AND NOT (raw_json #>> '{protocolSection,conditionsModule,keywords}' ILIKE '%choroideremia%')
AND NOT (raw_json #>> '{protocolSection,identificationModule,briefTitle}' ILIKE '%choroideremia%')
AND NOT (raw_json #>> '{protocolSection,identificationModule,officialTitle}' ILIKE '%choroideremia%')
AND NOT (raw_json #>> '{protocolSection,descriptionModule,briefSummary}' ILIKE '%choroideremia%')
AND NOT (raw_json #>> '{protocolSection,descriptionModule,detailedDescription}' ILIKE '%choroideremia%')
""".strip()

DRY_RUN_COUNT_SQL = f"""
SELECT COUNT(*)
FROM trials
WHERE {NON_CHM_WHERE_CLAUSE}
""".strip()

DELETE_NON_CHM_TRIALS_SQL = f"""
DELETE FROM trials
WHERE id IN (
  SELECT id FROM trials
  WHERE
    {NON_CHM_WHERE_CLAUSE}
)
""".strip()

DELETE_ORPHANED_TRIAL_EMBEDDINGS_SQL = """
DELETE FROM embeddings
WHERE source_type = 'trial'
  AND source_id NOT IN (SELECT id FROM trials)
""".strip()


async def main(*, dry_run: bool = False) -> None:
    async with AsyncSessionLocal() as session:
        if dry_run:
            result = await session.execute(text(DRY_RUN_COUNT_SQL))
            count = result.scalar_one()
            print(f"Would delete {count} non-CHM trials.")
            return

        delete_trials_result = await session.execute(text(DELETE_NON_CHM_TRIALS_SQL))
        deleted_trials = delete_trials_result.rowcount or 0
        print(f"Deleted {deleted_trials} non-CHM trials.")
        await session.commit()

        delete_embeddings_result = await session.execute(
            text(DELETE_ORPHANED_TRIAL_EMBEDDINGS_SQL)
        )
        deleted_embeddings = delete_embeddings_result.rowcount or 0
        print(f"Deleted {deleted_embeddings} stale trial embeddings.")
        await session.commit()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show how many non-CHM trials would be deleted without changing the database.",
    )
    args = parser.parse_args()
    asyncio.run(main(dry_run=args.dry_run))
