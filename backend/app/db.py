import logging
from collections.abc import AsyncIterator

from sqlalchemy import text
from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings


settings = get_settings()
logger = logging.getLogger("candle.api")
engine = create_async_engine(settings.async_database_url, pool_pre_ping=True)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

SCHEMA_RECONCILIATION_STATEMENTS = (
    """
    CREATE EXTENSION IF NOT EXISTS pg_trgm
    """,
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
    """
    CREATE INDEX IF NOT EXISTS idx_trials_title_trgm
    ON trials USING gin (title gin_trgm_ops)
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_trials_sponsor_trgm
    ON trials USING gin (sponsor gin_trgm_ops)
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_publications_title_trgm
    ON publications USING gin (title gin_trgm_ops)
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_publications_abstract_trgm
    ON publications USING gin (abstract gin_trgm_ops)
    """,
)


async def reconcile_database_schema() -> None:
    try:
        async with engine.begin() as conn:
            for statement in SCHEMA_RECONCILIATION_STATEMENTS:
                try:
                    await conn.execute(text(statement))
                except ProgrammingError:
                    if settings.deployment_env == "production":
                        raise
                    logger.warning(
                        "Skipping schema statement during development because it is unavailable: %s",
                        " ".join(statement.split()),
                    )
    except (OperationalError, OSError):
        if settings.deployment_env == "production":
            raise
        logger.warning(
            "Skipping database schema reconciliation because the database is unavailable."
        )
    else:
        logger.info("Database schema reconciliation completed.")


async def check_database_connectivity() -> bool:
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except (OperationalError, OSError):
        return False
    return True


async def get_session() -> AsyncIterator[AsyncSession]:
    async with AsyncSessionLocal() as session:
        yield session
