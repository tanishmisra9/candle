"""Async engine/session plumbing and startup schema reconciliation.

There is no migration tool. `db/init/001_schema.sql` creates the base tables on first Docker start
and `SCHEMA_RECONCILIATION_STATEMENTS` is run in one transaction on every boot: every statement
must be idempotent (`IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`). Add schema changes there.
In production a failing statement raises (a missing `pg_trgm` is fatal); in development it is
logged and skipped so a laptop without the extension can still run. Embeddings are stored as
`halfvec(3072)` with an HNSW cosine index, and the one-time column-type migration is guarded by a
pgvector version check.
"""

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
PG_TRGM_EXTENSION_STATEMENT = "CREATE EXTENSION IF NOT EXISTS pg_trgm"

SCHEMA_RECONCILIATION_STATEMENTS = (
    PG_TRGM_EXTENSION_STATEMENT,
    """
    ALTER TABLE trials
        ADD COLUMN IF NOT EXISTS ai_summary TEXT,
        ADD COLUMN IF NOT EXISTS ai_summary_generated_at TIMESTAMPTZ
    """,
    # A summary always has an attempt time (see SummaryState in app/ingest/summarise.py). Rows from before
    # the attempt column existed have a summary and no time: give them one (they then wait out the normal
    # 7-day window instead of being regenerated at once), so the CHECK below can never trip an upsert of
    # an old row. NOT VALID: the table may already hold rows; it is enforced for every new write.
    """
    UPDATE trials SET ai_summary_generated_at = NOW()
    WHERE ai_summary IS NOT NULL AND ai_summary_generated_at IS NULL
    """,
    """
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trials_ai_summary_attempt_check') THEN
            ALTER TABLE trials ADD CONSTRAINT trials_ai_summary_attempt_check
                CHECK (ai_summary IS NULL OR ai_summary_generated_at IS NOT NULL) NOT VALID;
        END IF;
    END
    $$
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
    """
    CREATE INDEX IF NOT EXISTS idx_trials_updated_at
    ON trials (updated_at)
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_trials_cursor_sort
    ON trials (COALESCE(start_date, completion_date) DESC NULLS LAST, id ASC)
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_publications_updated_at
    ON publications (updated_at)
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_publications_cursor_sort
    ON publications (pub_date DESC NULLS LAST, pmid ASC)
    """,
    """
    DO $$
    DECLARE
        pgvector_version TEXT;
        embedding_type TEXT;
    BEGIN
        SELECT extversion INTO pgvector_version
        FROM pg_extension
        WHERE extname = 'vector';

        IF pgvector_version IS NULL THEN
            RAISE EXCEPTION 'pgvector extension is not installed';
        END IF;

        IF string_to_array(pgvector_version, '.')::int[] < ARRAY[0,7,0] THEN
            RAISE EXCEPTION
                'pgvector >= 0.7.0 is required for halfvec(3072) embeddings (found %)',
                pgvector_version;
        END IF;

        SELECT atttypid::regtype::text INTO embedding_type
        FROM pg_attribute
        WHERE attrelid = 'embeddings'::regclass
          AND attname = 'embedding'
          AND NOT attisdropped;

        IF embedding_type IS NULL THEN
            RETURN;
        END IF;

        IF embedding_type = 'halfvec' THEN
            RETURN;
        END IF;

        DROP INDEX IF EXISTS idx_embeddings_embedding_ivfflat;
        DROP INDEX IF EXISTS idx_embeddings_embedding_hnsw;
        TRUNCATE embeddings;
        ALTER TABLE embeddings
            ALTER COLUMN embedding TYPE halfvec(3072)
            USING embedding::halfvec(3072);

        CREATE INDEX IF NOT EXISTS idx_embeddings_embedding_hnsw
            ON embeddings
            USING hnsw (embedding halfvec_cosine_ops);
    END $$;
    """,
    """
    ALTER TABLE embeddings
        ADD COLUMN IF NOT EXISTS content_tsv tsvector
        GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_embeddings_content_tsv
    ON embeddings USING GIN (content_tsv)
    """,
)


async def reconcile_database_schema() -> None:
    """Run `SCHEMA_RECONCILIATION_STATEMENTS` in one transaction (see module docstring for production vs development failure handling)."""
    try:
        async with engine.begin() as conn:
            for statement in SCHEMA_RECONCILIATION_STATEMENTS:
                try:
                    await conn.execute(text(statement))
                except ProgrammingError as exc:
                    is_pg_trgm_statement = statement.strip() == PG_TRGM_EXTENSION_STATEMENT
                    if settings.deployment_env == "production":
                        if is_pg_trgm_statement:
                            raise RuntimeError(
                                "Postgres extension pg_trgm is required in production. "
                                "Grant the database role permission to create extensions or "
                                "preinstall pg_trgm before starting Candle."
                            ) from exc
                        raise
                    logger.warning(
                        "Skipping schema statement during development because it is unavailable%s: %s",
                        " (pg_trgm extension)" if is_pg_trgm_statement else "",
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
    """Return True if a `SELECT 1` succeeds; used by `/readyz`."""
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except (OperationalError, OSError):
        return False
    return True


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency yielding one `AsyncSession` per request."""
    async with AsyncSessionLocal() as session:
        yield session
