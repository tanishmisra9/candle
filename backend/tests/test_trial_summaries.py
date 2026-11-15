from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from app.ingest.summarise import generate_trial_summaries, trial_summary_user_message
from app.ingest.summarise import generate_trial_summary_text, stale_trial_stmt
from app.services.openai_executor import OpenAITimeoutError


class DummyScalarResult:
    def __init__(self, trials):
        self._trials = trials

    def all(self):
        return self._trials


class DummyExecuteResult:
    def __init__(self, trials):
        self._trials = trials

    def scalars(self):
        return DummyScalarResult(self._trials)


class DummySummarySession:
    def __init__(self, trials):
        self.trials = trials
        self.statements = []
        self.commit_calls = 0

    async def execute(self, stmt):
        self.statements.append(stmt)
        params = stmt.compile().params
        limit = next(
            (value for value in reversed(list(params.values())) if isinstance(value, int)),
            len(self.trials),
        )
        # Mirrors stale_trial_stmt: never attempted, or last attempted over 7 days ago.
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        stale_trials = [
            trial
            for trial in self.trials
            if trial.ai_summary_generated_at is None or trial.ai_summary_generated_at < cutoff
        ]
        return DummyExecuteResult(stale_trials[:limit])

    async def commit(self):
        self.commit_calls += 1


def make_trial(trial_id: str, **overrides):
    payload = {
        "id": trial_id,
        "title": f"Trial {trial_id}",
        "status": "RECRUITING",
        "phase": "PHASE2",
        "intervention": "Gene therapy",
        "primary_endpoint": "BCVA",
        "sponsor": "Candle",
        "enrollment": 12,
        "ai_summary": None,
        "ai_summary_generated_at": None,
    }
    payload.update(overrides)
    return SimpleNamespace(**payload)


def test_trial_summary_user_message_normalizes_unknown_fields():
    trial = make_trial(
        "NCT00000001",
        status=None,
        phase=None,
        intervention=None,
        primary_endpoint=None,
        sponsor=None,
        enrollment=None,
    )

    message = trial_summary_user_message(trial)

    assert "None" not in message
    assert "Status: Unknown" in message
    assert "Enrollment: Unknown" in message


@pytest.mark.asyncio
async def test_generate_trial_summaries_updates_trials_and_sleeps(monkeypatch):
    trials = [make_trial("NCT00000001"), make_trial("NCT00000002")]
    session = DummySummarySession(trials)
    summary_calls = []
    sleep_calls = []

    async def fake_generate_trial_summary_text(trial):
        summary_calls.append(trial.id)
        return f"Summary for {trial.id}"

    async def fake_sleep(seconds):
        sleep_calls.append(seconds)

    monkeypatch.setattr(
        "app.ingest.summarise.generate_trial_summary_text",
        fake_generate_trial_summary_text,
    )
    monkeypatch.setattr("app.ingest.summarise.asyncio.sleep", fake_sleep)

    count = await generate_trial_summaries(session)

    assert count == 2
    assert summary_calls == ["NCT00000001", "NCT00000002"]
    assert sleep_calls == [0.5]
    assert session.commit_calls == 2
    assert [trial.ai_summary for trial in trials] == [
        "Summary for NCT00000001",
        "Summary for NCT00000002",
    ]
    assert all(isinstance(trial.ai_summary_generated_at, datetime) for trial in trials)
    assert all(trial.ai_summary_generated_at.tzinfo == timezone.utc for trial in trials)

    sql = str(session.statements[0])
    # Keyed on the attempt timestamp only (see test_stale_trial_stmt_does_not_reselect_...).
    assert "trials.ai_summary_generated_at IS NULL" in sql
    assert "trials.ai_summary IS NULL" not in sql
    assert "interval '7 days'" in sql


@pytest.mark.asyncio
async def test_generate_trial_summaries_raises_when_openai_key_missing(monkeypatch):
    session = DummySummarySession([make_trial("NCT00000001")])

    monkeypatch.setattr(
        "app.ingest.summarise.get_settings",
        lambda: SimpleNamespace(openai_api_key=""),
    )

    with pytest.raises(
        RuntimeError, match="OPENAI_API_KEY is required for trial summary generation."
    ):
        await generate_trial_summaries(session)

    assert session.commit_calls == 0


@pytest.mark.asyncio
async def test_generate_trial_summary_text_raises_timeout(monkeypatch):
    trial = make_trial("NCT00000003")

    monkeypatch.setattr(
        "app.ingest.summarise.get_settings",
        lambda: SimpleNamespace(
            openai_api_key="test-key",
            trial_summary_timeout_seconds=20,
            background_openai_max_retries=2,
            background_openai_retry_backoff_seconds=0.5,
        ),
    )

    async def fake_run_openai_operation(*args, **kwargs):
        raise OpenAITimeoutError("OpenAI request timed out.")

    monkeypatch.setattr(
        "app.ingest.summarise.run_openai_operation",
        fake_run_openai_operation,
    )

    with pytest.raises(OpenAITimeoutError, match="OpenAI request timed out."):
        await generate_trial_summary_text(trial)


@pytest.mark.asyncio
async def test_generate_trial_summaries_fetches_stale_trials_in_batches(monkeypatch):
    trials = [make_trial(f"NCT{i:08d}") for i in range(1, 22)]
    session = DummySummarySession(trials)
    sleep_calls = []

    async def fake_generate_trial_summary_text(trial):
        return f"Summary for {trial.id}"

    async def fake_sleep(seconds):
        sleep_calls.append(seconds)

    monkeypatch.setattr(
        "app.ingest.summarise.generate_trial_summary_text",
        fake_generate_trial_summary_text,
    )
    monkeypatch.setattr("app.ingest.summarise.asyncio.sleep", fake_sleep)

    count = await generate_trial_summaries(session)

    assert count == 21
    assert session.commit_calls == 21
    assert len(session.statements) == 3
    assert len(sleep_calls) == 19


@pytest.mark.asyncio
async def test_generate_trial_summaries_keeps_partial_progress_on_mid_batch_failure(
    monkeypatch,
):
    trials = [
        make_trial("NCT00000001"),
        make_trial("NCT00000002"),
        make_trial("NCT00000003"),
    ]
    session = DummySummarySession(trials)

    async def fake_generate_trial_summary_text(trial):
        if trial.id == "NCT00000002":
            raise RuntimeError("temporary failure")
        return f"Summary for {trial.id}"

    monkeypatch.setattr(
        "app.ingest.summarise.generate_trial_summary_text",
        fake_generate_trial_summary_text,
    )

    async def fake_sleep(_seconds):
        return None

    monkeypatch.setattr("app.ingest.summarise.asyncio.sleep", fake_sleep)

    with pytest.raises(RuntimeError, match="temporary failure"):
        await generate_trial_summaries(session)

    assert session.commit_calls == 1
    assert trials[0].ai_summary == "Summary for NCT00000001"
    assert isinstance(trials[0].ai_summary_generated_at, datetime)
    assert trials[1].ai_summary is None
    assert trials[1].ai_summary_generated_at is None
    assert trials[2].ai_summary is None
    assert trials[2].ai_summary_generated_at is None


def test_stale_trial_stmt_does_not_reselect_trials_that_were_already_attempted():
    # A trial whose model response was empty is stored with a NULL summary and a fresh
    # generated_at. Selecting on "ai_summary IS NULL" would pick it again immediately and the
    # `while True` loop would never end. Staleness must depend on the attempt timestamp only.
    sql = str(stale_trial_stmt(20).compile())

    assert "ai_summary IS NULL" not in sql.replace("ai_summary_generated_at", "")
    assert "ai_summary_generated_at IS NULL" in sql
    assert "interval" in sql.lower()


@pytest.mark.asyncio
async def test_empty_model_response_is_not_counted_and_does_not_loop(monkeypatch):
    trials = [make_trial("NCT00000001"), make_trial("NCT00000002")]
    session = DummySummarySession(trials)

    async def fake_generate_trial_summary_text(trial):
        return None if trial.id == "NCT00000001" else f"Summary for {trial.id}"

    async def fake_sleep(_seconds):
        return None

    monkeypatch.setattr(
        "app.ingest.summarise.generate_trial_summary_text",
        fake_generate_trial_summary_text,
    )
    monkeypatch.setattr("app.ingest.summarise.asyncio.sleep", fake_sleep)

    count = await generate_trial_summaries(session)

    assert count == 1  # only the trial that actually got a summary
    assert trials[0].ai_summary is None
    assert isinstance(trials[0].ai_summary_generated_at, datetime)  # attempted: retried after 7 days
    assert trials[1].ai_summary == "Summary for NCT00000002"


@pytest.mark.asyncio
async def test_empty_model_response_keeps_an_existing_summary(monkeypatch):
    # A stale trial that already has a good summary must not be overwritten with NULL when the
    # model returns nothing; only the attempt time moves so it is retried after the window.
    trial = make_trial(
        "NCT00000001",
        ai_summary="Old summary",
        ai_summary_generated_at=datetime.now(timezone.utc) - timedelta(days=8),
    )
    session = DummySummarySession([trial])

    async def fake_generate_trial_summary_text(_trial):
        return None

    async def fake_sleep(_seconds):
        return None

    monkeypatch.setattr(
        "app.ingest.summarise.generate_trial_summary_text",
        fake_generate_trial_summary_text,
    )
    monkeypatch.setattr("app.ingest.summarise.asyncio.sleep", fake_sleep)

    count = await generate_trial_summaries(session)

    assert count == 0
    assert trial.ai_summary == "Old summary"
    assert isinstance(trial.ai_summary_generated_at, datetime)


# --- the summary lifecycle is one enum + one edge table + one writer -------------------------------

NOW = datetime(2026, 11, 14, tzinfo=timezone.utc)


def _trial_in(state):
    from app.ingest.summarise import SummaryState

    return {
        SummaryState.NEVER_ATTEMPTED: make_trial("T1"),
        SummaryState.ATTEMPTED_EMPTY: make_trial("T1", ai_summary_generated_at=NOW - timedelta(days=8)),
        SummaryState.SUMMARISED: make_trial("T1", ai_summary="Old", ai_summary_generated_at=NOW - timedelta(days=8)),
    }[state]


@pytest.mark.parametrize(
    ("start", "summary", "expected"),
    [
        ("NEVER_ATTEMPTED", "New", "SUMMARISED"),
        ("NEVER_ATTEMPTED", None, "ATTEMPTED_EMPTY"),
        ("ATTEMPTED_EMPTY", "New", "SUMMARISED"),
        ("ATTEMPTED_EMPTY", None, "ATTEMPTED_EMPTY"),
        ("SUMMARISED", "New", "SUMMARISED"),
        ("SUMMARISED", None, "SUMMARISED"),  # an empty response keeps the existing summary
    ],
)
def test_every_allowed_summary_transition(start, summary, expected):
    from app.ingest.summarise import SummaryState, record_summary_attempt, summary_state

    trial = _trial_in(SummaryState[start])
    before = trial.ai_summary
    result = record_summary_attempt(trial, summary, NOW)

    assert result is SummaryState[expected]
    assert summary_state(trial) is SummaryState[expected]
    assert trial.ai_summary == (summary if summary is not None else before)
    assert trial.ai_summary_generated_at == NOW  # the attempt time always moves


def test_forbidden_summary_edges_are_not_in_the_edge_table():
    from app.ingest.summarise import SUMMARY_EDGES, SummaryState

    # Nothing returns to NEVER_ATTEMPTED (an attempt time is never cleared) ...
    assert all(SummaryState.NEVER_ATTEMPTED not in targets for targets in SUMMARY_EDGES.values())
    # ... and a summary never disappears.
    assert SummaryState.ATTEMPTED_EMPTY not in SUMMARY_EDGES[SummaryState.SUMMARISED]
    # Every state has an entry, and none is terminal (any trial is retried after the stale window).
    assert set(SUMMARY_EDGES) == set(SummaryState)
    assert all(SUMMARY_EDGES[state] for state in SummaryState)


def test_a_summary_without_an_attempt_time_is_rejected_loudly():
    from app.ingest.summarise import InvalidSummaryTransition, record_summary_attempt

    legacy = make_trial("T1", ai_summary="Old", ai_summary_generated_at=None)  # impossible since the CHECK
    with pytest.raises(InvalidSummaryTransition):
        record_summary_attempt(legacy, "New", NOW)


def test_a_disallowed_edge_is_refused_by_the_writer(monkeypatch):
    # If someone edits the edge table (or the target logic) so an illegal edge is requested, the
    # writer must refuse rather than write. Remove the guard and this fails.
    from app.ingest import summarise
    from app.ingest.summarise import InvalidSummaryTransition, SummaryState, record_summary_attempt

    monkeypatch.setitem(summarise.SUMMARY_EDGES, SummaryState.NEVER_ATTEMPTED, frozenset({SummaryState.SUMMARISED}))
    trial = make_trial("T1")
    with pytest.raises(InvalidSummaryTransition):
        record_summary_attempt(trial, None, NOW)  # NEVER_ATTEMPTED -> ATTEMPTED_EMPTY was removed
    assert trial.ai_summary_generated_at is None  # nothing was written


async def test_the_database_refuses_a_summary_without_an_attempt_time():
    # The CHECK `trials_ai_summary_attempt_check` is the database's side of the same rule. Needs the
    # local database; skipped without it.
    from sqlalchemy import text
    from sqlalchemy.exc import IntegrityError

    from app.db import AsyncSessionLocal, check_database_connectivity, engine, reconcile_database_schema

    if not await check_database_connectivity():
        pytest.skip("Database is unavailable.")
    try:
        await reconcile_database_schema()  # idempotent: applies the backfill + constraint if missing
        async with AsyncSessionLocal() as session:
            row = (await session.execute(text("SELECT id FROM trials LIMIT 1"))).first()
            if row is None:
                pytest.skip("No trials are loaded locally.")
            with pytest.raises(IntegrityError):
                await session.execute(
                    text("UPDATE trials SET ai_summary = 'x', ai_summary_generated_at = NULL WHERE id = :id"),
                    {"id": row[0]},
                )
            await session.rollback()
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_a_summary_without_an_attempt_time_is_repaired_instead_of_aborting_the_run(monkeypatch):
    # Impossible once the database CHECK exists, but if the schema step was skipped the whole batch must
    # not die on one bad row: it is stamped (-> summarised), no model call is wasted, and the rest go on.
    bad = make_trial("NCT00000001", ai_summary="Old summary", ai_summary_generated_at=None)
    good = make_trial("NCT00000002")
    session = DummySummarySession([bad, good])
    called: list[str] = []

    async def fake_generate_trial_summary_text(trial):
        called.append(trial.id)
        return f"Summary for {trial.id}"

    async def fake_sleep(_seconds):
        return None

    monkeypatch.setattr("app.ingest.summarise.generate_trial_summary_text", fake_generate_trial_summary_text)
    monkeypatch.setattr("app.ingest.summarise.asyncio.sleep", fake_sleep)

    count = await generate_trial_summaries(session)

    assert called == ["NCT00000002"]  # no model call for the repaired row
    assert count == 1
    assert bad.ai_summary == "Old summary"
    assert isinstance(bad.ai_summary_generated_at, datetime)
    assert good.ai_summary == "Summary for NCT00000002"
