# Architecture

Candle ingests Choroideremia (CHM) clinical trials and publications, links them, stores AI summaries, and answers grounded questions over the corpus. This document explains how the pieces fit and which invariants are deliberate.

```text
ClinicalTrials.gov ─┐                                  ┌─ GET /trials, /publications (cursor pages)
PubMed (E-utilities)┴─► ingest ─► Postgres ◄─ FastAPI ─┼─ POST /publications/{pmid}/overview
                         │          (pgvector, pg_trgm)  └─ POST /ask, /ask/stream  ─► OpenAI (+ Cohere rerank)
                         └─► OpenAI (embeddings, summaries, overviews)
React SPA (Vercel) ──────────────────────────────► FastAPI
```

## Data flow (ingest)

`make ingest` runs [`backend/app/ingest/run.py`](../backend/app/ingest/run.py), one step per session:

1. **Trials** (`clinicaltrials.py`): query `query.cond=choroideremia`, keep only studies that actually mention choroideremia (conditions, keywords, titles, descriptions), upsert on `Trial.id`. The raw study JSON is kept in `raw_json`.
2. **Publications** (`pubmed.py`): search `choroideremia[MeSH] OR "CHM gene therapy"` (hard cap of 500 ids), fetch abstracts in batches of 50, upsert on `pmid`.
3. **Link** (`link.py`): the first `NCT########` in a publication's title or abstract that matches an ingested trial becomes its `trial_id`.
4. **Overviews** (`overviews.py`): plain-language publication overviews, cached by (pmid, abstract hash, prompt version) so a repeat visit never calls the model. Bump `PUBLICATION_OVERVIEW_PROMPT_VERSION` to regenerate after a prompt change, or run `python -m app.ingest.overviews --force`.
5. **Embeddings** (`embed.py`): a trial or publication is re-embedded when it has no embedding or was updated after its newest one. Old chunks are deleted, new ones are stored in batches (512 texts). Chunk text is exactly what Ask retrieves and cites.
6. **Trial summaries** (`summarise.py`): 3-5 sentence summaries for trials with none or older than 7 days, committed **per trial** so a mid-batch failure keeps earlier progress.

Every run writes a `sync_log` row (`running`, then `success` or `error` with the message). `GET /sync/status` returns the last five; `GET /sync/last-synced` drives the "Data last synced" label.

## Schema management

There is **no migration tool**. `db/init/001_schema.sql` creates the base tables on first Docker start. After that, [`reconcile_database_schema()`](../backend/app/db.py) runs `SCHEMA_RECONCILIATION_STATEMENTS` in one transaction on every API boot, so every statement must be idempotent (`CREATE ... IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`). Add schema changes there, not as a separate migration.

- In **production** a failing statement raises (a missing `pg_trgm` is fatal with an explanatory message). In **development** it is logged and skipped, so a local database without the extension still starts.
- Embeddings are `halfvec(3072)` (not full `vector`) with an HNSW cosine index. A one-time in-place column type migration is guarded by a pgvector version check (>= 0.7.0).
- The full-text column is `embeddings.content_tsv`, a generated stored `tsvector` with a GIN index.
- `trials` has dedicated indexes backing the cursor sort order and trigram search; change sort logic only together with them (`tests/test_cursor_pagination.py`).

## Ask (RAG) pipeline

Implemented in [`backend/app/services/rag.py`](../backend/app/services/rag.py). `answer_question` (JSON) and `answer_question_stream` (SSE) share one pipeline.

1. **Intent routing** (`_route_by_intent`, `intent.py`). A regex distress check runs first, independent of any model. Then a small classifier labels the message; greetings, distress, advice-seeking and out-of-scope questions get a fixed reply and never reach retrieval. The classifier fails open to `info_request` (the regex check above still catches crisis language).
2. **Retrieval** (`retrieval.py`). The question is expanded with a small CHM glossary (retrieval only), then dense pgvector cosine search and Postgres full-text search run concurrently and are fused with Reciprocal Rank Fusion (`RRF_K = 60`), one entry per source.
3. **Rerank** (`rerank.py`). Optional Cohere rerank to `rerank_top_n`. Disabled, unkeyed or failing rerank degrades to the incoming order and never fails a request.
4. **CHM relevance filter**. Trial chunks are dropped unless the trial's own record mentions choroideremia (guards against non-CHM trials ingested before the relevance guard).
5. **Domain ranking** (`rank_chunks`). Deterministic tie-breaking: prefer trial records for "current/recruiting" questions, Phase 3 for "best/most promising". The model is never asked to rank trials evaluatively.
6. **Explicit ids**. `NCT########` and `PMID:` mentions in the question are always pulled in (with their linked trial/publication), regardless of ranking. "Current trials" questions also pull in active trials.
7. **Structured generation** under `SYSTEM_PROMPT`, constrained to `StructuredAskOutput` (`response_type` = `answer` | `refusal` | `insufficient_context`, `answer_text`, `cited_ids`).
8. **Output guard**. If the answer contains a prohibited phrase (`OUTPUT_PROHIBITED_PHRASES`) the entire answer is replaced by the refusal text, never partially redacted. A parse failure or timeout also fails closed to the refusal. Only cited sources are returned (max 5).

### Safety contract

The refusal wording, the prohibited phrases and the distress handling are **deliberate product behaviour**. Candle must never give clinical advice, evaluative rankings or prognosis, must attribute every claim to a source, and must use one of the three response types. Read `tests/test_rag_advice_guard.py` and `tests/test_safety_regression.py` before changing wording or control flow, and add a regression test for any new case.

### Streaming

`/ask/stream` emits server-sent events: `delta` (new answer text, extracted incrementally from the still-incomplete JSON), then one authoritative `done` (final answer and sources) or `error`. The advice-language guard runs **after** the stream is parsed, so streamed text can be replaced by the refusal in the `done` event. The frontend therefore always replaces its streamed text with the `done` payload; any other client must do the same. (Consequence: text that later fails the guard is briefly visible while streaming.)

## Request-level protections

In-process and per-worker (no Redis): state resets on restart and is not shared across workers.

- **Rate limits**: per-IP sliding window (limit plus burst) per route group: Ask (`/ask` and `/ask/stream` share one bucket), publication overview, and a looser one for plain read routes. The client IP is `X-Forwarded-For` only when `TRUST_PROXY_HEADERS` is true, which should be set only behind a real reverse proxy.
- **Concurrency cap**: a global limit on in-flight LLM requests; excess requests get 503 immediately.
- **Body size cap**: `LLMRequestBodyLimitMiddleware` rejects oversized bodies up front by `Content-Length` and again while streaming the body (a client can lie about the header). It covers `POST /ask`, `POST /ask/stream` and `POST /publications/{pmid}/overview`; adding a new LLM-backed POST route means adding it to `is_llm_endpoint` (the test `test_body_limit_matches_only_llm_post_routes` pins the list). The question text is also capped (`ask_question_max_chars`) after parsing.
- A WAF or reverse-proxy throttle in front of the LLM routes is still recommended when public.

## Frontend

See [`frontend/README.md`](../frontend/README.md). Highlights: detail views are stacked overlay dialogs (not routes); `lib/api.ts` is the only API boundary; the app has light and dark themes driven by CSS variable tokens with a contrast test; accessibility conventions are documented there and in `frontend/docs/ADA_CLOSURE.md`.

## Deployment

Frontend on Vercel (SPA rewrite in `vercel.json`, `VITE_API_BASE_URL` at build time). Backend: `backend/Procfile` and `backend/nixpacks.toml` (`uv sync --no-dev`, then `uvicorn`). Per the project history the Railway/Railpack deploy runs `uv sync --locked`, so a `pyproject.toml` change without a regenerated `uv.lock` fails the deploy (see [CONTRIBUTING](CONTRIBUTING.md#lockfiles)); I could not verify that deploy configuration from the repo. Production needs Postgres with pgvector and `pg_trgm`, `DEPLOYMENT_ENV=production` and an explicit `DATABASE_URL` (startup refuses the local default).
