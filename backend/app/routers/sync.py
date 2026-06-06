from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import SyncLog
from app.schemas import SyncLogEntry, SyncStatusResponse


router = APIRouter(tags=["sync"])


@router.get("/status", response_model=list[SyncLogEntry])
async def sync_status(session: AsyncSession = Depends(get_session)) -> list[SyncLogEntry]:
    result = await session.execute(
        select(SyncLog).order_by(SyncLog.started_at.desc()).limit(5)
    )
    return [SyncLogEntry.model_validate(row) for row in result.scalars().all()]


@router.get("/last-synced", response_model=SyncStatusResponse)
async def sync_last_synced(session: AsyncSession = Depends(get_session)) -> SyncStatusResponse:
    last_synced = await session.scalar(
        select(func.max(SyncLog.finished_at)).where(SyncLog.status == "success")
    )
    return SyncStatusResponse(last_synced=last_synced)
