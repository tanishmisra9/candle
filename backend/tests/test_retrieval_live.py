"""
Tier-2 live retrieval regression tests.

Requires OPENAI_API_KEY and a reachable database with indexed embeddings.
Run manually:
    pytest -m live backend/tests/test_retrieval_live.py --timeout=120
"""

from __future__ import annotations

import os

import pytest

from app.config import get_settings
from app.db import AsyncSessionLocal, check_database_connectivity
from app.services.embeddings import embed_query
from app.services.glossary import expand_query
from app.services.retrieval import retrieve_hybrid_chunks

TARGET_TRIAL_ID = "NCT03496012"
QUERY = "completed phase 3 trials"


@pytest.fixture(autouse=True)
def require_live_prerequisites():
    if not os.environ.get("OPENAI_API_KEY") and not get_settings().openai_api_key:
        pytest.skip("OPENAI_API_KEY is required for live retrieval tests.")


@pytest.mark.live
@pytest.mark.asyncio
async def test_completed_phase_3_trials_retrieves_biib111_in_top_6():
    if not await check_database_connectivity():
        pytest.skip("Database is unavailable for live retrieval test.")

    expanded = expand_query(QUERY)
    assert expanded == QUERY

    embedding = await embed_query(QUERY)
    async with AsyncSessionLocal() as session:
        results = await retrieve_hybrid_chunks(session, expanded, embedding, limit=50)

    top_ids = [chunk.source_id for chunk in results[:6]]
    assert TARGET_TRIAL_ID in top_ids, (
        f"Expected {TARGET_TRIAL_ID} in top 6 hybrid results; got {top_ids}"
    )
