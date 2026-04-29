from __future__ import annotations

import base64
import json
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Publication, Trial
from app.schemas import TrialCursorPage, TrialDetail, TrialSummary
from app.services.trials import derive_outcomes


router = APIRouter(prefix="/trials", tags=["trials"])


def encode_trial_cursor(sort_date: date | None, trial_id: str) -> str:
    payload = {
        "sort_date": sort_date.isoformat() if sort_date else None,
        "id": trial_id,
    }
    return base64.urlsafe_b64encode(json.dumps(payload).encode("utf-8")).decode("ascii")


def decode_trial_cursor(cursor: str) -> tuple[date | None, str]:
    try:
        payload = json.loads(base64.urlsafe_b64decode(cursor.encode("ascii")).decode("utf-8"))
        raw_date = payload.get("sort_date")
        trial_id = payload["id"]
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=400, detail="Invalid cursor.") from exc

    if raw_date is None:
        return None, trial_id

    try:
        return date.fromisoformat(raw_date), trial_id
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid cursor.") from exc


async def fetch_trial_cursor_page(
    session: AsyncSession,
    *,
    status: str | None,
    phase: str | None,
    intervention_type: str | None,
    sponsor: str | None,
    q: str | None,
    limit: int,
    cursor: str | None,
) -> TrialCursorPage:
    sort_date = func.coalesce(Trial.start_date, Trial.completion_date).label("sort_date")
    stmt = select(Trial, sort_date)

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

    if cursor:
        cursor_date, cursor_id = decode_trial_cursor(cursor)
        if cursor_date is None:
            stmt = stmt.where(
                and_(
                    sort_date.is_(None),
                    Trial.id > cursor_id,
                )
            )
        else:
            stmt = stmt.where(
                or_(
                    sort_date.is_(None),
                    sort_date < cursor_date,
                    and_(sort_date == cursor_date, Trial.id > cursor_id),
                )
            )

    stmt = stmt.order_by(sort_date.desc().nullslast(), Trial.id.asc()).limit(limit + 1)
    result = await session.execute(stmt)
    rows = result.all()
    has_more = len(rows) > limit
    rows = rows[:limit]

    items = [TrialSummary.model_validate(trial) for trial, _ in rows]
    next_cursor = None
    if has_more and rows:
        last_trial, last_sort_date = rows[-1]
        next_cursor = encode_trial_cursor(last_sort_date, last_trial.id)

    return TrialCursorPage(items=items, next_cursor=next_cursor)


@router.get("", response_model=list[TrialSummary] | TrialCursorPage)
async def list_trials(
    status: str | None = None,
    phase: str | None = None,
    intervention_type: str | None = None,
    sponsor: str | None = None,
    q: str | None = None,
    cursor: str | None = None,
    envelope: bool = False,
    limit: int = Query(default=100, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
) -> list[TrialSummary] | TrialCursorPage:
    if cursor or envelope:
        return await fetch_trial_cursor_page(
            session,
            status=status,
            phase=phase,
            intervention_type=intervention_type,
            sponsor=sponsor,
            q=q,
            limit=limit,
            cursor=cursor,
        )

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
