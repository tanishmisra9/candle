from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Publication, Trial
from app.schemas import TrialDetail, TrialSummary
from app.services.trials import derive_outcomes


router = APIRouter(prefix="/trials", tags=["trials"])


@router.get("", response_model=list[TrialSummary])
async def list_trials(
    status: str | None = None,
    phase: str | None = None,
    intervention_type: str | None = None,
    sponsor: str | None = None,
    q: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
) -> list[TrialSummary]:
    stmt = select(Trial).order_by(
        func.coalesce(Trial.start_date, Trial.completion_date).desc().nullslast(),
        Trial.title.asc(),
    )

    if status:
        stmt = stmt.where(func.lower(Trial.status) == status.lower())
    if phase:
        stmt = stmt.where(func.lower(Trial.phase) == phase.lower())
    if intervention_type:
        stmt = stmt.where(func.lower(Trial.intervention_type) == intervention_type.lower())
    if sponsor:
        stmt = stmt.where(Trial.sponsor.ilike(f"%{sponsor}%"))
    if q:
        stmt = stmt.where(Trial.title.ilike(f"%{q}%"))

    result = await session.execute(stmt.limit(limit))
    return [TrialSummary.model_validate(row) for row in result.scalars().all()]


@router.get("/{trial_id}", response_model=TrialDetail)
async def get_trial(
    trial_id: str, session: AsyncSession = Depends(get_session)
) -> TrialDetail:
    trial = await session.scalar(select(Trial).where(Trial.id == trial_id))
    if not trial:
        raise HTTPException(status_code=404, detail="Trial not found")

    publications_result = await session.execute(
        select(Publication)
        .where(Publication.trial_id == trial_id)
        .order_by(Publication.pub_date.desc().nullslast(), Publication.title.asc())
    )
    publications = publications_result.scalars().all()

    payload = TrialSummary.model_validate(trial).model_dump()
    payload["ai_summary"] = trial.ai_summary
    payload["publications"] = [pub for pub in publications]
    payload["outcomes"] = derive_outcomes(trial.raw_json)
    return TrialDetail.model_validate(payload)
