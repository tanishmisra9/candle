from __future__ import annotations

import json
from unittest.mock import MagicMock

import pytest

from app.schemas import AskSource, StructuredAskOutput
from app.services.rag import (
    ADVICE_REFUSAL,
    GREETING_RESPONSE,
    answer_question_stream,
    extract_partial_answer_text,
)


class _FakeSession:
    async def scalars(self, *_args, **_kwargs):
        class _Empty:
            def all(self):
                return []

        return _Empty()

    async def scalar(self, *_args, **_kwargs):
        return None


class _FakeStreamEvent:
    def __init__(self, content: str | None) -> None:
        self.choices = []
        if content is not None:
            delta = MagicMock()
            delta.content = content
            choice = MagicMock()
            choice.delta = delta
            self.choices = [choice]


async def _fake_stream(chunks: list[str]):
    for chunk in chunks:
        yield _FakeStreamEvent(chunk)


def test_extract_partial_answer_text_grows_incrementally() -> None:
    buffers = [
        '{"response_type": "answer", "answer_text": "Hel',
        '{"response_type": "answer", "answer_text": "Hello',
        '{"response_type": "answer", "answer_text": "Hello world',
        '{"response_type": "answer", "answer_text": "Hello world", "cited_ids": []}',
    ]
    seen: list[str] = []
    for buf in buffers:
        current = extract_partial_answer_text(buf)
        if not seen or current != seen[-1]:
            seen.append(current)
    assert seen == ["Hel", "Hello", "Hello world"]


def test_extract_partial_answer_text_handles_escaped_quotes() -> None:
    buffer = r'{"answer_text": "Line one.\nLine two."}'
    assert extract_partial_answer_text(buffer) == "Line one.\nLine two."


def test_extract_partial_answer_text_returns_empty_before_field() -> None:
    assert extract_partial_answer_text('{"response_type": "answer"') == ""


async def _collect_stream_events(question: str, monkeypatch) -> list[dict]:
    events: list[dict] = []
    async for event_json in answer_question_stream(question, _FakeSession()):
        events.append(json.loads(event_json))
    return events


@pytest.mark.asyncio
async def test_greeting_short_circuit_emits_only_done(monkeypatch) -> None:
    async def _fake_classify(_question: str):
        from app.services.intent import IntentClassification

        return IntentClassification(intent="greeting")

    monkeypatch.setattr("app.services.rag.classify_intent", _fake_classify)

    events = await _collect_stream_events("hello", monkeypatch)

    assert len(events) == 1
    assert events[0]["type"] == "done"
    assert events[0]["answer"] == GREETING_RESPONSE
    assert events[0]["sources"] == []


@pytest.mark.asyncio
async def test_info_request_stream_emits_deltas_then_done(monkeypatch) -> None:
    full_json = json.dumps(
        {
            "response_type": "answer",
            "answer_text": "According to NCT02435940, a trial is recruiting.",
            "cited_ids": ["NCT02435940"],
        }
    )
    chunks = [full_json[i : i + 8] for i in range(0, len(full_json), 8)]

    async def _fake_classify(_question: str):
        from app.services.intent import IntentClassification

        return IntentClassification(intent="info_request")

    async def _fake_prepare(_question, _session):
        sources = {
            "trial:NCT02435940": AskSource(
                source_type="trial",
                source_id="NCT02435940",
                title="Trial A",
                url="https://example.com/a",
            ),
        }
        return "ready", [], [], sources, "context block"

    async def _fake_create(**_kwargs):
        return _fake_stream(chunks)

    async def _fake_enrich(_session, enriched):
        return enriched

    mock_client = MagicMock()
    mock_client.chat.completions.create = _fake_create
    monkeypatch.setattr("app.services.rag.classify_intent", _fake_classify)
    monkeypatch.setattr("app.services.rag._prepare_question_context", _fake_prepare)
    monkeypatch.setattr("app.services.rag.get_openai_client", lambda: mock_client)
    monkeypatch.setattr("app.services.rag.enrich_sources", _fake_enrich)

    events = await _collect_stream_events("What trials are recruiting?", monkeypatch)

    deltas = [e for e in events if e["type"] == "delta"]
    dones = [e for e in events if e["type"] == "done"]
    assert len(deltas) >= 1
    assert "".join(d["delta"] for d in deltas) == (
        "According to NCT02435940, a trial is recruiting."
    )
    assert len(dones) == 1
    assert dones[0]["sources"][0]["source_id"] == "NCT02435940"


@pytest.mark.asyncio
async def test_refusal_stream_replaces_partial_text_in_done(monkeypatch) -> None:
    full_json = json.dumps(
        {
            "response_type": "refusal",
            "answer_text": ADVICE_REFUSAL,
            "cited_ids": [],
        }
    )
    chunks = [full_json[i : i + 24] for i in range(0, len(full_json), 24)]

    async def _fake_classify(_question: str):
        from app.services.intent import IntentClassification

        return IntentClassification(intent="info_request")

    async def _fake_prepare(_question, _session):
        return "ready", [], [], {}, "context block"

    async def _fake_create(**_kwargs):
        return _fake_stream(chunks)

    mock_client = MagicMock()
    mock_client.chat.completions.create = _fake_create
    monkeypatch.setattr("app.services.rag.classify_intent", _fake_classify)
    monkeypatch.setattr("app.services.rag._prepare_question_context", _fake_prepare)
    monkeypatch.setattr("app.services.rag.get_openai_client", lambda: mock_client)

    events = await _collect_stream_events("hypothetical advice", monkeypatch)

    deltas = [e for e in events if e["type"] == "delta"]
    done = next(e for e in events if e["type"] == "done")
    assert len(deltas) >= 1
    assert done["answer"] == ADVICE_REFUSAL
    assert done["sources"] == []
