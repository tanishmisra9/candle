from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.schemas import AskRequest, AskResponse
from app.services.llm_guardrails import (
    ASK_ROUTE,
    ask_question_max_chars,
    enforce_llm_body_size,
    enforce_llm_rate_limit,
    llm_concurrency_slot,
)
from app.services.rag import answer_question


router = APIRouter(tags=["ask"])


@router.post("/ask", response_model=AskResponse)
async def ask(
    request: Request,
    payload: AskRequest,
    session: AsyncSession = Depends(get_session),
) -> AskResponse:
    await enforce_llm_body_size(request)
    await enforce_llm_rate_limit(request, ASK_ROUTE)

    question = payload.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    if len(question) > ask_question_max_chars():
        raise HTTPException(status_code=413, detail="Question is too long for this endpoint.")

    try:
        async with llm_concurrency_slot():
            return await answer_question(question, session)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
