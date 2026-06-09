import pytest

from app.schemas import StructuredAskOutput
from app.services.rag import (
    ADVICE_REFUSAL,
    SYSTEM_PROMPT,
    answer_question,
    contains_advice_language,
    is_distress_message,
)


class _FakeSession:
    async def scalars(self, *_args, **_kwargs):
        class _Empty:
            def all(self):
                return []

        return _Empty()

    async def scalar(self, *_args, **_kwargs):
        return None


def test_output_validation_catches_slippage():
    assert (
        contains_advice_language(
            "This trial shows promise and you might benefit from enrolling."
        )
        is True
    )


def test_output_validation_passes_factual():
    assert (
        contains_advice_language(
            "In this study of 12 participants, the reported BCVA change was +0.2 logMAR."
        )
        is False
    )


def test_distress_detection():
    assert is_distress_message("I don't want to live like this anymore") is True


def test_system_prompt_requires_answers_to_follow_retrieved_sources():
    assert (
        "Your answer must come from the provided context sources. Never answer from general knowledge."
        in SYSTEM_PROMPT
    )
    assert (
        "If sources are present in the context, your answer MUST be derived from those sources."
        in SYSTEM_PROMPT
    )
    assert "Speak as if you simply know this." not in SYSTEM_PROMPT
    assert "strongest alternative" not in SYSTEM_PROMPT


def test_system_prompt_trial_records_authoritative_for_metadata():
    assert "TRIAL RECORDS ARE AUTHORITATIVE FOR TRIAL METADATA" in SYSTEM_PROMPT
    assert '"Status:", "Phase:", "Study Type:", "Intervention Type:"' in SYSTEM_PROMPT
    assert (
        "do not hedge based on what publications say about the same trial"
        in SYSTEM_PROMPT
    )


def test_system_prompt_requires_structured_output():
    assert "STRUCTURED OUTPUT" in SYSTEM_PROMPT
    assert '"response_type"' in SYSTEM_PROMPT
    assert '"cited_ids"' in SYSTEM_PROMPT
    assert "Do not embed [NCT...] or [PMID...] markers in answer_text" in SYSTEM_PROMPT


@pytest.mark.asyncio
async def test_structured_output_advice_slippage_forces_refusal(monkeypatch) -> None:
    async def _fake_classify(_question: str):
        from app.services.intent import IntentClassification

        return IntentClassification(intent="info_request")

    async def _fake_prepare(_question, _session):
        return "ready", [], [], {}, "context block"

    async def _fake_generate(_question, _context):
        return StructuredAskOutput(
            response_type="answer",
            answer_text="This trial shows promise and you might benefit from enrolling.",
            cited_ids=[],
        )

    async def _fake_enrich(_session, sources):
        return sources

    monkeypatch.setattr("app.services.rag.classify_intent", _fake_classify)
    monkeypatch.setattr("app.services.rag._prepare_question_context", _fake_prepare)
    monkeypatch.setattr("app.services.rag._generate_structured_answer", _fake_generate)
    monkeypatch.setattr("app.services.rag.enrich_sources", _fake_enrich)

    result = await answer_question("What trials use AAV2?", _FakeSession())

    assert result.answer == ADVICE_REFUSAL
    assert result.sources == []


@pytest.mark.asyncio
async def test_malformed_structured_output_fails_closed(monkeypatch) -> None:
    async def _fake_classify(_question: str):
        from app.services.intent import IntentClassification

        return IntentClassification(intent="info_request")

    async def _fake_prepare(_question, _session):
        return "ready", [], [], {}, "context block"

    async def _fake_generate(_question, _context):
        return None

    monkeypatch.setattr("app.services.rag.classify_intent", _fake_classify)
    monkeypatch.setattr("app.services.rag._prepare_question_context", _fake_prepare)
    monkeypatch.setattr("app.services.rag._generate_structured_answer", _fake_generate)

    result = await answer_question("What trials are recruiting?", _FakeSession())

    assert result.answer == ADVICE_REFUSAL
    assert result.sources == []


@pytest.mark.asyncio
async def test_structured_output_filters_sources_by_cited_ids(monkeypatch) -> None:
    from app.schemas import AskSource

    async def _fake_classify(_question: str):
        from app.services.intent import IntentClassification

        return IntentClassification(intent="info_request")

    sources = {
        "trial:NCT02435940": AskSource(
            source_type="trial",
            source_id="NCT02435940",
            title="Trial A",
            url="https://example.com/a",
        ),
        "trial:NCT03507686": AskSource(
            source_type="trial",
            source_id="NCT03507686",
            title="Trial B",
            url="https://example.com/b",
        ),
    }

    async def _fake_prepare(_question, _session):
        return "ready", [], [], sources, "context block"

    async def _fake_generate(_question, _context):
        return StructuredAskOutput(
            response_type="answer",
            answer_text=(
                "According to NCT02435940, a Phase 1/2 AAV2-REP1 trial is recruiting. "
                "For the most current information, verify at clinicaltrials.gov."
            ),
            cited_ids=["NCT02435940"],
        )

    async def _fake_enrich(_session, enriched):
        return enriched

    monkeypatch.setattr("app.services.rag.classify_intent", _fake_classify)
    monkeypatch.setattr("app.services.rag._prepare_question_context", _fake_prepare)
    monkeypatch.setattr("app.services.rag._generate_structured_answer", _fake_generate)
    monkeypatch.setattr("app.services.rag.enrich_sources", _fake_enrich)

    result = await answer_question("What gene therapy trials are recruiting?", _FakeSession())

    assert "[NCT" not in result.answer
    assert len(result.sources) == 1
    assert result.sources[0].source_id == "NCT02435940"


@pytest.mark.asyncio
async def test_insufficient_context_returns_empty_sources(monkeypatch) -> None:
    async def _fake_classify(_question: str):
        from app.services.intent import IntentClassification

        return IntentClassification(intent="info_request")

    async def _fake_prepare(_question, _session):
        return "ready", [], [], {}, "context block"

    async def _fake_generate(_question, _context):
        return StructuredAskOutput(
            response_type="insufficient_context",
            answer_text=(
                "I don't have indexed records on that topic. "
                "Try clinicaltrials.gov or pubmed.ncbi.nlm.nih.gov."
            ),
            cited_ids=[],
        )

    monkeypatch.setattr("app.services.rag.classify_intent", _fake_classify)
    monkeypatch.setattr("app.services.rag._prepare_question_context", _fake_prepare)
    monkeypatch.setattr("app.services.rag._generate_structured_answer", _fake_generate)

    result = await answer_question("What about CHM in Antarctica?", _FakeSession())

    assert result.sources == []
    assert "indexed records" in result.answer.lower()
