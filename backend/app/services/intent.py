"""Fast intent classifier that short-circuits Ask before any retrieval.

A small model labels the message `greeting`, `info_request`, `advice_seeking`, `distress` or
`out_of_scope`. It fails open to `info_request` (no key, timeout, bad output); the separate regex
distress check in `app.services.rag` runs first so a classifier outage cannot hide a crisis message.
"""

from __future__ import annotations

import logging
from typing import Literal

from pydantic import BaseModel, ValidationError

from app.config import get_settings
from app.services.embeddings import get_openai_client
from app.services.openai_executor import run_openai_operation
from app.services.openai_schema import strict_json_schema

logger = logging.getLogger("candle.api")

INTENT_SYSTEM_PROMPT = """Classify the user's message into exactly one category:
- "greeting": pleasantries, hellos, thanks, casual openers
- "info_request": asking for factual information about CHM, trials, publications, the disease, gene therapy, research
- "advice_seeking": asking for personal medical advice, treatment recommendations, eligibility decisions, prognosis predictions, "which trial should I" questions
- "distress": expressing emotional crisis, suicidal ideation, severe distress
- "out_of_scope": any topic unrelated to CHM, retinal disease, or rare disease research

Return JSON: {"intent": "..."}
"""


class IntentClassification(BaseModel):
    intent: Literal[
        "greeting",
        "info_request",
        "advice_seeking",
        "distress",
        "out_of_scope",
    ]


async def classify_intent(question: str) -> IntentClassification:
    """Classify with the fast model (strict JSON, 5s timeout, no retries). Any failure returns `info_request`."""
    settings = get_settings()
    if not settings.openai_api_key:
        return IntentClassification(intent="info_request")

    try:
        response = await run_openai_operation(
            lambda: get_openai_client().chat.completions.create(
                model=settings.intent_classifier_model,
                temperature=0,
                max_tokens=20,
                messages=[
                    {"role": "system", "content": INTENT_SYSTEM_PROMPT},
                    {"role": "user", "content": question},
                ],
                response_format=strict_json_schema(
                    IntentClassification, name="intent_classification"
                ),
            ),
            timeout_seconds=settings.intent_classifier_timeout_seconds,
            retries=0,
            retry_backoff_seconds=0,
        )
        content = response.choices[0].message.content or ""
        return IntentClassification.model_validate_json(content)
    except (ValidationError, Exception) as exc:
        logger.warning("Intent classification failed, defaulting to info_request: %s", exc)
        return IntentClassification(intent="info_request")
