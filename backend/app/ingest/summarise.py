"""AI trial summaries (3-5 plain-English sentences) for trials never attempted or last attempted over 7 days ago, committed per trial."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import Trial
from app.services.embeddings import get_openai_client
from app.services.openai_executor import run_openai_operation

logger = logging.getLogger("candle.ingest")


TRIAL_SUMMARY_SYSTEM_PROMPT = (
    "You are a plain-English medical research assistant. Write a 3-5 sentence summary "
    "of this clinical trial aimed at a patient or patient advocate who is not a "
    "clinician. Focus on: what the trial is testing, what phase it is in, what the "
    "primary endpoint is, and the current status. Be factual and calm in tone."
)
SUMMARY_COMMIT_BATCH_SIZE = 20


class SummaryState(str, Enum):
    """Where a trial is in the summary lifecycle. Derived from two columns, never stored on its own:

    NEVER_ATTEMPTED  ai_summary NULL,     ai_summary_generated_at NULL
    ATTEMPTED_EMPTY  ai_summary NULL,     ai_summary_generated_at set   (the model returned nothing)
    SUMMARISED       ai_summary set,      ai_summary_generated_at set

    A summary without an attempt time is impossible (the database CHECK
    `trials_ai_summary_attempt_check` in app/db.py enforces it). No state is terminal: any trial is
    retried once its last attempt is over 7 days old (`stale_trial_stmt`).
    """

    NEVER_ATTEMPTED = "never_attempted"
    ATTEMPTED_EMPTY = "attempted_empty"
    SUMMARISED = "summarised"


# The ONLY allowed transitions. Forbidden (and tested): anything -> NEVER_ATTEMPTED (an attempt time
# is never cleared), and SUMMARISED -> ATTEMPTED_EMPTY (an existing summary never disappears: an
# empty model response keeps it and only moves the attempt time).
SUMMARY_EDGES: dict[SummaryState, frozenset[SummaryState]] = {
    SummaryState.NEVER_ATTEMPTED: frozenset({SummaryState.SUMMARISED, SummaryState.ATTEMPTED_EMPTY}),
    SummaryState.ATTEMPTED_EMPTY: frozenset({SummaryState.SUMMARISED, SummaryState.ATTEMPTED_EMPTY}),
    SummaryState.SUMMARISED: frozenset({SummaryState.SUMMARISED}),
}


class InvalidSummaryTransition(Exception):
    pass


def summary_state(trial: Trial) -> SummaryState:
    """The trial's current state; raises on the impossible combination (summary without an attempt time)."""
    if trial.ai_summary_generated_at is None:
        if trial.ai_summary is not None:
            raise InvalidSummaryTransition(
                f"Trial {trial.id} has a summary but no attempt time (violates trials_ai_summary_attempt_check)"
            )
        return SummaryState.NEVER_ATTEMPTED
    return SummaryState.SUMMARISED if trial.ai_summary is not None else SummaryState.ATTEMPTED_EMPTY


def record_summary_attempt(trial: Trial, summary: str | None, now: datetime) -> SummaryState:
    """The single writer of `ai_summary` / `ai_summary_generated_at`. Returns the new state.

    A real summary replaces the stored one; an empty response (`None`) keeps any existing summary and
    only moves the attempt time. Every write is checked against `SUMMARY_EDGES` first.
    """
    current = summary_state(trial)
    target = (
        SummaryState.SUMMARISED
        if summary is not None
        else (current if current is SummaryState.SUMMARISED else SummaryState.ATTEMPTED_EMPTY)
    )
    if target not in SUMMARY_EDGES[current]:
        raise InvalidSummaryTransition(f"{current.value} -> {target.value} is not allowed for trial {trial.id}")
    if summary is not None:
        trial.ai_summary = summary
    trial.ai_summary_generated_at = now
    return target


def stale_trial_stmt(limit: int):
    """Trials never attempted or last attempted over 7 days ago, oldest first (keyed on the attempt timestamp, so an empty response is not re-selected)."""
    return (
        select(Trial)
        .where(
            # Staleness is about the last *attempt*, not the stored text: a trial whose model
            # response was empty keeps a NULL summary but a fresh timestamp, so it is retried
            # after the normal window instead of being re-selected forever by the loop below.
            or_(
                Trial.ai_summary_generated_at.is_(None),
                Trial.ai_summary_generated_at < func.now() - text("interval '7 days'"),
            )
        )
        .order_by(Trial.ai_summary_generated_at.asc().nullsfirst(), Trial.id.asc())
        .limit(limit)
    )


def trial_summary_user_message(trial: Trial) -> str:
    enrollment = f"{trial.enrollment} patients" if trial.enrollment is not None else "Unknown"
    return (
        f"Trial title: {trial.title or 'Unknown'}\n"
        f"Status: {trial.status or 'Unknown'}\n"
        f"Phase: {trial.phase or 'Unknown'}\n"
        f"Intervention: {trial.intervention or 'Unknown'}\n"
        f"Primary endpoint: {trial.primary_endpoint or 'Unknown'}\n"
        f"Sponsor: {trial.sponsor or 'Unknown'}\n"
        f"Enrollment: {enrollment}"
    )


async def generate_trial_summary_text(trial: Trial) -> str | None:
    """One chat call; raises if no API key. An empty model response returns None."""
    settings = get_settings()
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is required for trial summary generation.")

    response = await run_openai_operation(
        lambda: get_openai_client().chat.completions.create(
            model=settings.chat_model,
            temperature=0.2,
            messages=[
                {"role": "system", "content": TRIAL_SUMMARY_SYSTEM_PROMPT},
                {"role": "user", "content": trial_summary_user_message(trial)},
            ],
        ),
        timeout_seconds=settings.trial_summary_timeout_seconds,
        retries=settings.background_openai_max_retries,
        retry_backoff_seconds=settings.background_openai_retry_backoff_seconds,
    )
    return (response.choices[0].message.content or "").strip() or None


async def generate_trial_summaries(session: AsyncSession) -> int:
    """Summarise stale trials in batches of 20, committing after each trial. An empty model response is logged, leaves any existing summary untouched, records a fresh attempt time (retried after 7 days) and is not counted. Returns the number of summaries actually generated."""
    generated_count = 0
    while True:
        trials = (await session.execute(stale_trial_stmt(SUMMARY_COMMIT_BATCH_SIZE))).scalars().all()
        if not trials:
            break

        # Keep the stale-trial batch fetch to avoid loading the full table at once,
        # but commit each completed summary so partial progress survives upstream failures.
        for index, trial in enumerate(trials, start=1):
            if trial.ai_summary is not None and trial.ai_summary_generated_at is None:
                # Impossible once the database CHECK is in place, but a skipped/failed schema step
                # (development tolerates that) must not abort the whole run: stamp an attempt time
                # (-> SUMMARISED, retried after the normal window) and move on without a model call.
                logger.warning("Trial %s had a summary but no attempt time; repairing", trial.id)
                trial.ai_summary_generated_at = datetime.now(timezone.utc)
                await session.commit()
                continue
            summary = await generate_trial_summary_text(trial)
            record_summary_attempt(trial, summary, datetime.now(timezone.utc))
            if summary is None:
                # Keep any existing summary; only the attempt time moves.
                logger.warning("Empty trial summary for %s; will retry after the stale window", trial.id)
            else:
                generated_count += 1
            await session.commit()

            if index < len(trials):
                await asyncio.sleep(0.5)

    return generated_count
