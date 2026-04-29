import base64
import binascii
import hashlib
import json
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Publication
from app.schemas import (
    PublicationCursorPage,
    PublicationOverviewResponse,
    PublicationSummary,
)
from app.services.llm_guardrails import (
    PUBLICATION_OVERVIEW_ROUTE,
    enforce_llm_rate_limit,
    llm_concurrency_slot,
)
from app.services.openai_executor import (
    OpenAIServiceUnavailableError,
    OpenAITimeoutError,
)
from app.services.publication_overviews import (
    get_or_generate_publication_overview,
)


router = APIRouter(prefix="/publications", tags=["publications"])


def publication_filter_signature(*, trial_id: str | None, q: str | None, limit: int) -> str:
    payload = {
        "trial_id": (trial_id or "").strip().lower(),
        "q": (q or "").strip().lower(),
        "limit": limit,
    }
    serialized = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()[:16]


def encode_publication_cursor(pub_date: date | None, pmid: str, filter_signature: str) -> str:
    payload = {
        "version": 1,
        "pub_date": pub_date.isoformat() if pub_date else None,
        "pmid": pmid,
        "filter_signature": filter_signature,
    }
    return base64.urlsafe_b64encode(json.dumps(payload).encode("utf-8")).decode("ascii")


def decode_publication_cursor(cursor: str) -> tuple[date | None, str, str]:
    try:
        payload = json.loads(base64.urlsafe_b64decode(cursor.encode("ascii")).decode("utf-8"))
        raw_date = payload.get("pub_date")
        pmid = payload["pmid"]
        version = payload["version"]
        filter_signature = payload["filter_signature"]
    except (
        KeyError,
        TypeError,
        ValueError,
        json.JSONDecodeError,
        binascii.Error,
    ) as exc:
        raise HTTPException(status_code=400, detail="Invalid cursor.") from exc
    if version != 1:
        raise HTTPException(status_code=400, detail="Invalid cursor.")

    if raw_date is None:
        return None, pmid, filter_signature

    try:
        return date.fromisoformat(raw_date), pmid, filter_signature
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid cursor.") from exc


async def fetch_publication_cursor_page(
    session: AsyncSession,
    *,
    trial_id: str | None,
    q: str | None,
    limit: int,
    cursor: str | None,
) -> PublicationCursorPage:
    stmt = select(Publication)
    current_signature = publication_filter_signature(trial_id=trial_id, q=q, limit=limit)
    if trial_id:
        stmt = stmt.where(Publication.trial_id == trial_id)
    if q:
        search = f"%{q}%"
        stmt = stmt.where(
            or_(Publication.title.ilike(search), Publication.abstract.ilike(search))
        )

    if cursor:
        cursor_date, cursor_pmid, cursor_signature = decode_publication_cursor(cursor)
        if cursor_signature != current_signature:
            raise HTTPException(
                status_code=400,
                detail="Cursor does not match the current filters.",
            )
        if cursor_date is None:
            stmt = stmt.where(
                Publication.pub_date.is_(None),
                Publication.pmid > cursor_pmid,
            )
        else:
            stmt = stmt.where(
                or_(
                    Publication.pub_date.is_(None),
                    Publication.pub_date < cursor_date,
                    (Publication.pub_date == cursor_date) & (Publication.pmid > cursor_pmid),
                )
            )

    stmt = stmt.order_by(Publication.pub_date.desc().nullslast(), Publication.pmid.asc()).limit(
        limit + 1
    )
    result = await session.execute(stmt)
    publications = result.scalars().all()
    has_more = len(publications) > limit
    publications = publications[:limit]

    next_cursor = None
    if has_more and publications:
        last_publication = publications[-1]
        next_cursor = encode_publication_cursor(
            last_publication.pub_date,
            last_publication.pmid,
            current_signature,
        )

    return PublicationCursorPage(
        items=[PublicationSummary.model_validate(publication) for publication in publications],
        next_cursor=next_cursor,
    )


@router.get("", response_model=list[PublicationSummary] | PublicationCursorPage)
async def list_publications(
    trial_id: str | None = None,
    q: str | None = None,
    cursor: str | None = None,
    envelope: bool = False,
    limit: int = Query(default=200, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
) -> list[PublicationSummary] | PublicationCursorPage:
    if cursor or envelope:
        return await fetch_publication_cursor_page(
            session,
            trial_id=trial_id,
            q=q,
            limit=limit,
            cursor=cursor,
        )

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
    await enforce_llm_rate_limit(request, PUBLICATION_OVERVIEW_ROUTE)

    publication = await session.get(Publication, pmid)
    if publication is None:
        raise HTTPException(status_code=404, detail="Publication not found")

    try:
        async with llm_concurrency_slot():
            overview, _generated = await get_or_generate_publication_overview(
                session, publication
            )
    except OpenAITimeoutError as exc:
        raise HTTPException(status_code=504, detail="Publication overview timed out.") from exc
    except OpenAIServiceUnavailableError as exc:
        raise HTTPException(
            status_code=503,
            detail="Publication overview service is temporarily unavailable.",
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - exercised via API smoke test
        raise HTTPException(
            status_code=500, detail="Unable to generate publication overview."
        ) from exc

    return PublicationOverviewResponse(overview=overview)
