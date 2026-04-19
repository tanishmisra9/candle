from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from app.ingest.summarise import generate_trial_summaries, trial_summary_user_message


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
        return DummyExecuteResult(self.trials)

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
    assert "trials.ai_summary IS NULL" in sql
    assert "trials.ai_summary_generated_at" in sql
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
