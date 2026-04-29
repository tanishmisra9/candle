from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Publication
from app.schemas import PublicationOverviewResponse, PublicationSummary
from app.services.llm_guardrails import (
    PUBLICATION_OVERVIEW_ROUTE,
    enforce_llm_body_size,
    enforce_llm_rate_limit,
    llm_concurrency_slot,
)
from app.services.publication_overviews import (
    get_or_generate_publication_overview,
)


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


@router.post("/{pmid}/overview", response_model=PublicationOverviewResponse)
async def publication_overview(
    pmid: str,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> PublicationOverviewResponse:
    await enforce_llm_body_size(request)
    await enforce_llm_rate_limit(request, PUBLICATION_OVERVIEW_ROUTE)

    publication = await session.get(Publication, pmid)
    if publication is None:
        raise HTTPException(status_code=404, detail="Publication not found")

    try:
        async with llm_concurrency_slot():
            overview, _generated = await get_or_generate_publication_overview(
                session, publication
            )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except TimeoutError as exc:
        raise HTTPException(status_code=504, detail="Publication overview timed out.") from exc
    except Exception as exc:  # pragma: no cover - exercised via API smoke test
        raise HTTPException(
            status_code=500, detail="Unable to generate publication overview."
        ) from exc

    return PublicationOverviewResponse(overview=overview)
