from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import SyncLog
from app.schemas import SyncLogEntry


router = APIRouter(tags=["sync"])


@router.get("/status", response_model=list[SyncLogEntry])
async def sync_status(session: AsyncSession = Depends(get_session)) -> list[SyncLogEntry]:
    result = await session.execute(
        select(SyncLog).order_by(SyncLog.started_at.desc()).limit(5)
    )
    return [SyncLogEntry.model_validate(row) for row in result.scalars().all()]
