from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.schemas import AskRequest, AskResponse
from app.services.rag import answer_question


router = APIRouter(tags=["ask"])


@router.post("/ask", response_model=AskResponse)
async def ask(
    payload: AskRequest, session: AsyncSession = Depends(get_session)
) -> AskResponse:
    question = payload.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    try:
        return await answer_question(question, session)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
