import logging
from collections.abc import AsyncIterator

from sqlalchemy import text
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings


settings = get_settings()
logger = logging.getLogger("candle.api")
engine = create_async_engine(settings.database_url, pool_pre_ping=True)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

SCHEMA_RECONCILIATION_STATEMENTS = (
    """
    ALTER TABLE trials
        ADD COLUMN IF NOT EXISTS ai_summary TEXT,
        ADD COLUMN IF NOT EXISTS ai_summary_generated_at TIMESTAMPTZ
    """,
    """
    CREATE TABLE IF NOT EXISTS sync_log (
        id SERIAL PRIMARY KEY,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        finished_at TIMESTAMPTZ,
        trials_ingested INTEGER,
        publications_ingested INTEGER,
        publications_linked INTEGER,
        embeddings_stored INTEGER,
        summaries_generated INTEGER,
        status TEXT,
        error_message TEXT
    )
    """,
)


async def reconcile_database_schema() -> None:
    try:
        async with engine.begin() as conn:
            for statement in SCHEMA_RECONCILIATION_STATEMENTS:
                await conn.execute(text(statement))
    except (OperationalError, OSError):
        logger.warning(
            "Skipping database schema reconciliation because the database is unavailable."
        )
    else:
        logger.info("Database schema reconciliation completed.")


async def get_session() -> AsyncIterator[AsyncSession]:
    async with AsyncSessionLocal() as session:
        yield session
