"""Two app processes starting together must both get through schema reconciliation.

`reconcile_database_schema` runs on every boot. The `trials_ai_summary_attempt_check` block is
check-then-add (`IF NOT EXISTS ... ADD CONSTRAINT`), which two simultaneous boots (a rolling deploy,
several workers) can both pass: the second `ADD CONSTRAINT` then fails with "already exists" and, in
production, takes that process down at startup.

Today that cannot happen only by coincidence: the statement before it, `ALTER TABLE trials ADD COLUMN IF
NOT EXISTS`, takes an ACCESS EXCLUSIVE lock even when it changes nothing, so boots queue up behind it.
Reordering the statements would silently remove that. So the serialisation is explicit: the first
statement is a transaction-scoped advisory lock, and these tests strip out the accidental serialiser to
prove it is the lock doing the work. Needs the local database; skipped without it.
"""

import asyncio

import pytest
from sqlalchemy import text


def _constraint_block(statements) -> str:
    return next(s for s in statements if "DO $$" in s and "trials_ai_summary_attempt_check" in s)


def test_the_first_statement_serialises_concurrent_boots():
    from app.db import SCHEMA_RECONCILIATION_STATEMENTS

    assert "pg_advisory_xact_lock" in SCHEMA_RECONCILIATION_STATEMENTS[0]


async def test_two_concurrent_boots_both_succeed_without_relying_on_the_alter_table_lock(monkeypatch):
    from app import db
    from app.db import SCHEMA_RECONCILIATION_STATEMENTS, check_database_connectivity, engine, reconcile_database_schema

    if not await check_database_connectivity():
        pytest.skip("Database is unavailable.")
    try:
        await reconcile_database_schema()  # make sure the schema exists before we break one part of it

        # Only the first statement (the lock, if there is one) and the check-then-add block, then a
        # pause that stands in for the rest of the statements, so the first boot's transaction stays
        # open while the second one reaches the block. No ALTER TABLE in between to queue them.
        stripped = (SCHEMA_RECONCILIATION_STATEMENTS[0], _constraint_block(SCHEMA_RECONCILIATION_STATEMENTS), "SELECT pg_sleep(0.3)")
        monkeypatch.setattr(db, "SCHEMA_RECONCILIATION_STATEMENTS", stripped)
        monkeypatch.setattr(db.settings, "deployment_env", "production")  # production raises on a failed statement

        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE trials DROP CONSTRAINT IF EXISTS trials_ai_summary_attempt_check"))

        await asyncio.gather(reconcile_database_schema(), reconcile_database_schema())

        async with engine.connect() as conn:
            present = (
                await conn.execute(text("SELECT 1 FROM pg_constraint WHERE conname = 'trials_ai_summary_attempt_check'"))
            ).first()
        assert present is not None
    finally:
        monkeypatch.undo()
        await reconcile_database_schema()  # leave the local database as the app expects it
        await engine.dispose()
