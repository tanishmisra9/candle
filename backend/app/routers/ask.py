"""`POST /ask` (single JSON response) and `POST /ask/stream` (server-sent events).

Both share one pipeline (`app.services.rag`), the `ask` rate-limit bucket, the global LLM
concurrency slot and the `ask_question_max_chars` cap. The stream emits `data: {json}` frames of
type `delta` (answer text so far), `done` (final answer plus sources, authoritative) or `error`.
The frontend replaces any streamed text with the `done` payload.
"""

import json

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.schemas import AskRequest, AskResponse
from app.services.llm_guardrails import (
    ASK_ROUTE,
    ask_question_max_chars,
    enforce_rate_limit,
    llm_concurrency_slot,
)
from app.services.openai_executor import (
    OpenAIServiceUnavailableError,
    OpenAITimeoutError,
)
from app.services.rag import answer_question, answer_question_stream


router = APIRouter(tags=["ask"])


@router.post("/ask", response_model=AskResponse)
async def ask(
    request: Request,
    payload: AskRequest,
    session: AsyncSession = Depends(get_session),
) -> AskResponse:
    """Rate limit, validate question length, then answer within one LLM concurrency slot. Maps timeouts to 504 and provider outages to 503."""
    await enforce_rate_limit(request, ASK_ROUTE)

    question = payload.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    if len(question) > ask_question_max_chars():
        raise HTTPException(status_code=413, detail="Question is too long for this endpoint.")

    try:
        async with llm_concurrency_slot():
            return await answer_question(question, session)
    except OpenAITimeoutError as exc:
        raise HTTPException(status_code=504, detail="Ask request timed out.") from exc
    except OpenAIServiceUnavailableError as exc:
        raise HTTPException(
            status_code=503,
            detail="The AI service is temporarily unavailable.",
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/ask/stream")
async def ask_stream(
    request: Request,
    payload: AskRequest,
    session: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    """Same checks as `ask`, then stream the pipeline as server-sent events; provider failures are sent as `error` events since the response has already started."""
    await enforce_rate_limit(request, ASK_ROUTE)

    question = payload.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    if len(question) > ask_question_max_chars():
        raise HTTPException(status_code=413, detail="Question is too long for this endpoint.")

    async def event_generator():
        try:
            async with llm_concurrency_slot():
                async for event in answer_question_stream(question, session):
                    yield f"data: {event}\n\n"
        except OpenAITimeoutError:
            yield f"data: {json.dumps({'type': 'error', 'detail': 'Ask request timed out.'})}\n\n"
        except OpenAIServiceUnavailableError:
            yield (
                "data: "
                + json.dumps(
                    {
                        "type": "error",
                        "detail": "The AI service is temporarily unavailable.",
                    }
                )
                + "\n\n"
            )
        except RuntimeError as exc:
            yield f"data: {json.dumps({'type': 'error', 'detail': str(exc)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
