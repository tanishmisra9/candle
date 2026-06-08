# Candle

Candle is a quiet research dashboard for Choroideremia (CHM). It pulls clinical trials from ClinicalTrials.gov, publications from PubMed, links them where possible, generates persistent plain-language publication overviews and trial summaries, and lets you explore the corpus through a calmer interface for trials, literature, and grounded Q&A.

**Live app:** [https://www.candleforchm.org](https://www.candleforchm.org)

## What Candle Does

- **Trials** (`/trials`) — Browse CHM trials in grid or timeline view; open detailed trial snapshots with AI summaries, locations, and linked publications.
- **Literature** (`/literature`) — Search and paginate publications; open reader snapshots with persisted AI overviews and trial links.
- **Ask** (`/ask`) — Ask grounded questions across trials and publications via retrieval-augmented generation (RAG).
- **Home** (`/`) — Entry point with quick navigation into the three main areas.

Publication overviews and trial summaries are stored in Postgres after first generation so repeat visits stay fast.

## Stack

| Layer | Technologies |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Framer Motion, TanStack Query, React Router |
| Backend | FastAPI, SQLAlchemy (async), asyncpg, Pydantic Settings |
| Database | PostgreSQL 16 with **pgvector** (embeddings) and **pg_trgm** (substring search) |
| AI | OpenAI — chat for Ask, embeddings for retrieval, overviews and trial summaries during ingest |
| Local infra | Docker Compose (`pgvector/pgvector:pg16`) |

## Prerequisites

- Docker (for local Postgres)
- Python **3.11+**
- Node **20+**
- [`uv`](https://docs.astral.sh/uv/) (Python package manager)
- [`pnpm`](https://pnpm.io/) (frontend package manager)
- An **OpenAI API key**

## Quick Start

```bash
cp .env.example .env
# Edit .env and set OPENAI_API_KEY (required for Ask and AI summaries)

make bootstrap
```

`make bootstrap` installs dependencies, starts Postgres, runs the full ingest pipeline, then launches the backend and frontend.

Open:

- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend: [http://localhost:8000](http://localhost:8000)
- API health: [http://localhost:8000/healthz](http://localhost:8000/healthz)

## Local Development (manual)

```bash
git clone <repo-url> candle && cd candle

cp .env.example .env
# Set OPENAI_API_KEY and adjust URLs if needed

cd backend && uv sync && cd ..
pnpm --dir frontend install

make up          # Postgres
make wait-db     # optional: block until DB is ready
make ingest      # full data pipeline (see below)
make dev         # backend :8000 + frontend :5173
```

Or run services in separate terminals: `make backend` and `make frontend`.

## Environment Variables

Copy [`.env.example`](.env.example) to `.env` at the repo root. The backend reads the root `.env`; the frontend uses `VITE_*` variables at build time.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Async SQLAlchemy URL (default: local Docker Postgres) |
| `OPENAI_API_KEY` | Required for `/ask`, publication overviews, embeddings, trial summaries |
| `EMBEDDING_MODEL` | OpenAI embedding model (default: `text-embedding-3-large`) |
| `CHAT_MODEL` | OpenAI chat model for Ask (default: `gpt-4.1-mini`) |
| `FRONTEND_ORIGIN` | CORS allowlist for the API (default: `http://localhost:5173`) |
| `VITE_API_BASE_URL` | Frontend → backend base URL (default: `http://localhost:8000`) |
| `DEPLOYMENT_ENV` | `development` or `production` — enforces production DB URL and `pg_trgm` behavior |
| `TRUST_PROXY_HEADERS` | Set `true` behind a reverse proxy that sets `X-Forwarded-For` (rate limiting) |
| `CLINICAL_TRIALS_BASE_URL` | ClinicalTrials.gov API v2 base |
| `PUBMED_SEARCH_URL` / `PUBMED_FETCH_URL` | NCBI E-utilities endpoints |
| `NCBI_USER_AGENT` | Required identifier string for PubMed requests |

Rate limits and LLM guards (optional overrides via env) are defined in [`backend/app/config.py`](backend/app/config.py): Ask and publication-overview endpoints have per-IP limits, concurrency caps, body size limits, and timeouts.

## Makefile Commands

| Command | Description |
| --- | --- |
| `make up` | Start Postgres (Docker Compose) |
| `make down` | Stop Postgres |
| `make wait-db` | Wait until Postgres accepts connections |
| `make ingest` | Run full ingest pipeline (see [Data flow](#data-flow)) |
| `make backend` | FastAPI with reload on `:8000` |
| `make frontend` | Vite dev server on `:5173` |
| `make dev` | Backend + frontend together |
| `make bootstrap` | Install deps, start DB, ingest, then run dev servers |

### Ingest maintenance

Force-regenerate all publication overviews:

```bash
cd backend && uv run python -m app.ingest.overviews --force
```

## Data Flow

`make ingest` runs [`backend/app/ingest/run.py`](backend/app/ingest/run.py):

1. Ingest trials from ClinicalTrials.gov
2. Ingest publications from PubMed
3. Link publications to trials (heuristic matching)
4. Generate and persist publication overviews (OpenAI)
5. Store embeddings for trials and publications (pgvector)
6. Generate and persist AI trial summaries (checkpointed per trial)

Each run is recorded in `sync_log`. Trial summaries are committed individually so a partial failure does not discard earlier progress in the same batch.

## API Overview

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/healthz` | Liveness |
| `GET` | `/readyz` | Readiness (DB connectivity) |
| `GET` | `/trials` | List trials (cursor pagination with `envelope=true`) |
| `GET` | `/trials/{trial_id}` | Trial detail |
| `GET` | `/publications` | List publications (cursor pagination) |
| `POST` | `/publications/{pmid}/overview` | Generate or fetch persisted overview |
| `POST` | `/ask` | Grounded Q&A (RAG) |
| `GET` | `/sync/status` | Recent ingest run history |

## Testing

**Backend** (from `backend/`):

```bash
uv run pytest
```

**Frontend** (from `frontend/`):

```bash
pnpm test              # unit + component tests
pnpm run build         # typecheck + production build
```

Accessibility component tests (`vitest-axe`) live in `frontend/src/components/*.a11y.test.tsx`. See [Accessibility](#accessibility) below — passing these tests is necessary but not sufficient for full WCAG sign-off.

## Accessibility

The frontend includes structured landmarks, keyboard support, focus management for modals, reduced-motion handling, and automated axe checks on key components.

- Closure sign-off and residual manual QA: [`frontend/docs/ADA_CLOSURE.md`](frontend/docs/ADA_CLOSURE.md)
- **Important:** Component-level `vitest-axe` covers only part of real-world accessibility. Human review should still include full-route scans, screen readers (VoiceOver / NVDA), and contrast checks at 200% / 400% zoom before claiming full conformance.

## Deployment Notes

### Public exposure

If Candle is exposed on the public internet, add edge protection in front of expensive AI routes:

- `POST /ask`
- `POST /publications/{pmid}/overview`

The backend applies in-process rate limits, concurrency caps, and request body limits, but a WAF or reverse-proxy throttle is still recommended.

### Production database

- Use a managed Postgres with **pgvector** enabled (embeddings).
- Ensure **`pg_trgm`** is available for title/sponsor/abstract search indexes. Grant `CREATE EXTENSION` to the app role, or preinstall `pg_trgm` before the API starts.
- Set `DEPLOYMENT_ENV=production` and a non-default `DATABASE_URL`. The API refuses to start in production with the local default URL.

### Frontend (Vercel)

The SPA is configured in [`frontend/vercel.json`](frontend/vercel.json) with a catch-all rewrite to `index.html`. Set `VITE_API_BASE_URL` to your deployed API origin at build time.

## Pre-outreach Cleanup

Before CureCHM outreach, remove older non-CHM trials ingested before the relevance guard existed.

From `backend/`:

```bash
uv run python scripts/cleanup_non_chm_trials.py --dry-run
uv run python scripts/cleanup_non_chm_trials.py   # after reviewing counts
```

Then re-embed from the repo root:

```bash
make ingest
```

## Repo Layout

```text
candle/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI app, health, CORS
│   │   ├── routers/          # trials, publications, ask, sync
│   │   ├── services/         # RAG, embeddings, LLM guards, overviews
│   │   └── ingest/           # ClinicalTrials, PubMed, link, embed, summarise
│   ├── scripts/              # one-off maintenance (e.g. trial cleanup)
│   └── tests/
├── db/init/                  # initial SQL (extensions, tables)
├── frontend/
│   ├── src/                  # React app (views, components, hooks)
│   ├── docs/ADA_CLOSURE.md   # accessibility closure sign-off
│   └── vercel.json
├── docker-compose.yml
├── Makefile
├── .env.example
└── README.md
```

## Why This Exists

Candle exists because I also live with Choroideremia. That changes the shape of the work. This is patient-engineering: one place to see the trial landscape clearly, follow the literature without noise, and keep a small light on for the long journey.
