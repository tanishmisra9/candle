from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import Trial
from app.services.embeddings import get_openai_client
from app.services.openai_executor import run_openai_operation


TRIAL_SUMMARY_SYSTEM_PROMPT = (
    "You are a plain-English medical research assistant. Write a 3-5 sentence summary "
    "of this clinical trial aimed at a patient or patient advocate who is not a "
    "clinician. Focus on: what the trial is testing, what phase it is in, what the "
    "primary endpoint is, and the current status. Be factual and calm in tone."
)
SUMMARY_COMMIT_BATCH_SIZE = 20


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
    settings = get_settings()
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is required for trial summary generation.")

    response = await run_openai_operation(
        lambda: get_openai_client().chat.completions.create(
            model="gpt-4o-mini",
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
    stmt = (
        select(Trial)
        .where(
            or_(
                Trial.ai_summary.is_(None),
                Trial.ai_summary_generated_at < func.now() - text("interval '7 days'"),
            )
        )
        .order_by(Trial.ai_summary_generated_at.asc().nullsfirst(), Trial.id.asc())
    )
    trials = (await session.execute(stmt)).scalars().all()

    generated_count = 0

    for index, trial in enumerate(trials, start=1):
        summary = await generate_trial_summary_text(trial)
        trial.ai_summary = summary
        trial.ai_summary_generated_at = datetime.now(timezone.utc)
        generated_count += 1

        if index % SUMMARY_COMMIT_BATCH_SIZE == 0 or index == len(trials):
            await session.commit()

        if index < len(trials):
            await asyncio.sleep(0.5)

    return generated_count
