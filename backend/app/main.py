from __future__ import annotations

import logging
import time

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from app.config import DEFAULT_DATABASE_URL, get_settings
from app.db import check_database_connectivity, reconcile_database_schema
from app.routers.ask import router as ask_router
from app.routers.publications import router as publications_router
from app.routers.sync import router as sync_router
from app.routers.trials import router as trials_router


settings = get_settings()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("candle.api")

app = FastAPI(title="Candle API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def validate_settings() -> None:
    if settings.deployment_env == "production" and (
        not settings.database_url or settings.database_url == DEFAULT_DATABASE_URL
    ):
        raise RuntimeError("DATABASE_URL must be explicitly configured in production.")

    await reconcile_database_schema()

    if not settings.openai_api_key:
        logger.warning(
            "OPENAI_API_KEY is not set. The /ask endpoint and publication overviews "
            "will not function until it is configured in .env."
        )


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    logger.info(
        "%s %s -> %s (%.2f ms)",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


@app.get("/healthz")
async def healthz():
    return {"ok": True}


@app.get("/readyz")
async def readyz():
    if not await check_database_connectivity():
        raise HTTPException(status_code=503, detail="Database is not ready.")
    return {"ok": True}


app.include_router(trials_router)
app.include_router(publications_router)
app.include_router(ask_router)
app.include_router(sync_router, prefix="/sync")
