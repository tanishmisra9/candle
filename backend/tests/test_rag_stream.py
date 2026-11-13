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


class _ClosableStream:
    """Async-iterable fake of the OpenAI stream that records whether it was closed."""

    def __init__(self, chunks: list[str]) -> None:
        self._chunks = chunks
        self.closed = False

    def __aiter__(self):
        return self._iterate()

    async def _iterate(self):
        for chunk in self._chunks:
            yield _FakeStreamEvent(chunk)

    async def close(self) -> None:
        self.closed = True


def _patch_stream(monkeypatch, stream: _ClosableStream) -> None:
    async def _fake_classify(_question: str):
        from app.services.intent import IntentClassification

        return IntentClassification(intent="info_request")

    async def _fake_prepare(_question, _session):
        return "ready", [], [], {}, "context block"

    async def _fake_create(**_kwargs):
        return stream

    async def _fake_enrich(_session, sources):
        return sources

    mock_client = MagicMock()
    mock_client.chat.completions.create = _fake_create
    monkeypatch.setattr("app.services.rag.classify_intent", _fake_classify)
    monkeypatch.setattr("app.services.rag._prepare_question_context", _fake_prepare)
    monkeypatch.setattr("app.services.rag.get_openai_client", lambda: mock_client)
    monkeypatch.setattr("app.services.rag.enrich_sources", _fake_enrich)


def _chunked(payload: dict, size: int) -> list[str]:
    raw = json.dumps(payload)
    return [raw[i : i + size] for i in range(0, len(raw), size)]


@pytest.mark.asyncio
@pytest.mark.parametrize("chunk_size", [1, 7, 10_000])
async def test_stream_never_shows_a_prohibited_phrase_before_the_guard_replaces_it(
    monkeypatch, chunk_size
) -> None:
    # The guard used to run only after the stream ended, so "you should consider enrolling" was
    # visible in the UI until the final event replaced it. It must never be emitted at all, for
    # any chunking (including a phrase split across chunks).
    from app.services.rag import contains_advice_language

    answer = "Trial NCT02435940 is recruiting. You should consider enrolling in it right away."
    stream = _ClosableStream(
        _chunked({"response_type": "answer", "answer_text": answer, "cited_ids": []}, chunk_size)
    )
    _patch_stream(monkeypatch, stream)

    events = await _collect_stream_events("What is recruiting?", monkeypatch)

    shown = "".join(e["delta"] for e in events if e["type"] == "delta")
    assert not contains_advice_language(shown)
    assert "you should" not in shown.lower()
    done = [e for e in events if e["type"] == "done"]
    assert len(done) == 1
    assert done[0]["answer"] == ADVICE_REFUSAL
    assert done[0]["sources"] == []
    # We stop consuming the model once the answer is known to be blocked.
    assert stream.closed is True


@pytest.mark.asyncio
async def test_stream_still_delivers_a_clean_answer_in_full(monkeypatch) -> None:
    # The hold-back must be flushed once the final answer passes the guard.
    answer = "According to NCT02435940, the trial is recruiting adults with CHM."
    stream = _ClosableStream(
        _chunked({"response_type": "answer", "answer_text": answer, "cited_ids": []}, 5)
    )
    _patch_stream(monkeypatch, stream)

    events = await _collect_stream_events("What is recruiting?", monkeypatch)

    shown = "".join(e["delta"] for e in events if e["type"] == "delta")
    assert shown == answer
    assert next(e for e in events if e["type"] == "done")["answer"] == answer


@pytest.mark.asyncio
async def test_stream_does_not_guard_insufficient_context_text(monkeypatch) -> None:
    # Parity with the non-streaming path, which returns refusal/insufficient_context text as-is.
    answer = "I don't have indexed records on that. I suggest checking clinicaltrials.gov."
    stream = _ClosableStream(
        _chunked(
            {"response_type": "insufficient_context", "answer_text": answer, "cited_ids": []}, 6
        )
    )
    _patch_stream(monkeypatch, stream)

    events = await _collect_stream_events("Tell me about X", monkeypatch)

    shown = "".join(e["delta"] for e in events if e["type"] == "delta")
    assert shown == answer
    assert next(e for e in events if e["type"] == "done")["answer"] == answer
