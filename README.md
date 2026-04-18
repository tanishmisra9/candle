# Candle

Candle is a quiet local dashboard for Choroideremia clinical trial intelligence: it gathers CHM studies from ClinicalTrials.gov, publications from PubMed, links them where it can, and turns the whole set into a calm interface for browsing and asking grounded questions. It is meant to feel useful first, polished second, and gentle throughout.

## Prerequisites

- Docker
- Python 3.11+
- Node 20+
- `pnpm`
- An OpenAI API key

## 60-Second Setup

```bash
cp .env.example .env
# open .env and paste your OpenAI API key

make up
make ingest
make backend
make frontend

# then open http://localhost:5173
```

For a first-time one-command setup, Candle also supports:

```bash
make bootstrap
```

Full local run flow:

```bash
# 1. Clone and enter
git clone <repo> candle && cd candle

# 2. Configure
cp .env.example .env
# open .env and paste your OpenAI API key

# 3. Database
make up

# 4. Ingest real data (takes ~2–5 min)
cd backend && uv sync && cd ..
make ingest

# 5. Backend (terminal 1)
make backend

# 6. Frontend (terminal 2)
cd frontend && pnpm install && cd ..
make frontend

# 7. Open http://localhost:5173
```

## Repo Layout

```text
candle/
├── README.md
├── Makefile
├── .env.example
├── .gitignore
├── docker-compose.yml
├── db/
│   └── init/
│       └── 001_schema.sql
├── backend/
│   ├── pyproject.toml
│   ├── .python-version
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── db.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── routers/
│   │   ├── services/
│   │   └── ingest/
│   └── tests/
└── frontend/
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── tailwind.config.ts
    ├── postcss.config.js
    ├── index.html
    └── src/
```

## Why This Exists

Candle exists because the person building it is also living with CHM. That changes the shape of the work. This is patient-engineering: one place to see the trial landscape clearly, follow the literature without noise, and keep a small light on for the long journey.
