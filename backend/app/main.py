from __future__ import annotations

import logging
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers.ask import router as ask_router
from app.routers.publications import router as publications_router
from app.routers.trials import router as trials_router


settings = get_settings()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("candle.api")

app = FastAPI(title="Candle API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def validate_settings() -> None:
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


app.include_router(trials_router)
app.include_router(publications_router)
app.include_router(ask_router)
