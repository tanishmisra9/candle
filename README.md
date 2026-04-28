# Candle

Candle is a quiet research dashboard for Choroideremia (CHM). It pulls clinical trials from ClinicalTrials.gov, publications from PubMed, links them where possible, generates persistent plain-language publication overviews, and lets you explore the whole corpus through a calmer interface for trials, literature, and grounded Q&A.

Live app: [https://candle-ten-chi.vercel.app](https://candle-ten-chi.vercel.app)

## What Candle Does

- Browse CHM trials in grid or timeline view, with detailed trial snapshots.
- Explore linked literature in a dedicated reader with saved AI-generated overviews.
- Ask grounded questions across the trial and publication corpus.
- Keep publication overviews persistent in the database so they are fast after first generation.

## Prerequisites

- Docker
- Python 3.11+
- Node 20+
- `uv`
- `pnpm`
- An OpenAI API key

## Quick Start

The fastest first-time setup is:

```bash
cp .env.example .env
# open .env and paste your OpenAI API key

make bootstrap
```

Then open:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`

## Local Development

If you want to run the pieces manually:

```bash
# 1. Clone and enter
git clone <repo> candle && cd candle

# 2. Configure
cp .env.example .env
# open .env and paste your OpenAI API key

# 3. Install app dependencies
cd backend && uv sync && cd ..
pnpm --dir frontend install

# 4. Start Postgres
make up

# 5. Ingest real data
make ingest

# 6. Backend (terminal 1)
make backend

# 7. Frontend (terminal 2)
make frontend
```

## Useful Commands

```bash
make up         # start Postgres
make down       # stop Postgres
make ingest     # ingest trials + publications, link them, generate overviews, store embeddings
make backend    # run FastAPI on :8000
make frontend   # run Vite on :5173
make dev        # run backend + frontend together
make bootstrap  # one-command local setup
```

To force-refresh publication overviews for everything already saved:

```bash
cd backend && uv run python -m app.ingest.overviews --force
```

## Pre-outreach Cleanup

Before CureCHM outreach, run the one-time cleanup for older non-CHM trials that were ingested before the raw relevance guard existed.

From `backend/`:

```bash
uv run python scripts/cleanup_non_chm_trials.py --dry-run
```

Review the reported count. If it looks correct, run the cleanup for real:

```bash
uv run python scripts/cleanup_non_chm_trials.py
```

After the cleanup completes, re-run the embedding pipeline from the repo root so the current trial corpus is fully re-embedded:

```bash
make ingest
```

## Data Flow

`make ingest` runs the full backend pipeline:

1. ingest trials
2. ingest publications
3. link publications to trials
4. generate and persist publication overviews
5. store embeddings for Ask

## Stack

- Frontend: React, TypeScript, Vite, Tailwind, Framer Motion
- Backend: FastAPI, SQLAlchemy, asyncpg
- Database: Postgres
- AI: OpenAI for Ask responses and publication overviews

## Repo Layout

```text
candle/
├── backend/      # FastAPI app, ingest pipeline, AI services, tests
├── db/           # database initialization
├── frontend/     # React app
├── docker-compose.yml
├── Makefile
└── README.md
```

## Why This Exists

Candle exists because I also live with Choroideremia. That changes the shape of the work. This is patient-engineering: one place to see the trial landscape clearly, follow the literature without noise, and keep a small light on for the long journey.
