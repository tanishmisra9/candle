from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Publication
from app.schemas import PublicationSummary


router = APIRouter(prefix="/publications", tags=["publications"])


@router.get("", response_model=list[PublicationSummary])
async def list_publications(
    trial_id: str | None = None,
    q: str | None = None,
    limit: int = Query(default=200, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
) -> list[PublicationSummary]:
    stmt = select(Publication).order_by(
        Publication.pub_date.desc().nullslast(), Publication.title.asc()
    )
    if trial_id:
        stmt = stmt.where(Publication.trial_id == trial_id)
    if q:
        search = f"%{q}%"
        stmt = stmt.where(
            or_(Publication.title.ilike(search), Publication.abstract.ilike(search))
        )

    result = await session.execute(stmt.limit(limit))
    return [PublicationSummary.model_validate(row) for row in result.scalars().all()]
