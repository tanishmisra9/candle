# Contributing

Candle is a patient-facing health research tool. Two things outrank everything else: **the Ask safety contract** and **accessibility**. Both have automated checks, and both have parts that only a real browser or a person can verify.

## Setup

See the [README](../README.md#quick-start). In short: `cp .env.example .env`, set `OPENAI_API_KEY`, `make bootstrap`.

## Tests

```bash
# backend (from backend/)
uv run pytest            # offline; live tests are excluded
uv run pytest -m live    # needs OPENAI_API_KEY, hits the real API

# frontend (from frontend/)
pnpm test                # unit, component, vitest-axe, colour contrast
pnpm run build           # tsc -b && vite build (the typecheck gate)
```

CI (`.github/workflows/lockfiles.yml`) only checks lockfile drift. It does **not** run tests, so run them locally before pushing.

### Lockfiles

If you edit `backend/pyproject.toml` or `frontend/package.json`, regenerate the matching lockfile **in the same change**: `cd backend && uv lock` / `cd frontend && pnpm install`. CI runs `uv lock --check` and `pnpm install --frozen-lockfile`, and a dependency removed without a regenerated `uv.lock` once broke every backend deploy for a month (the locked install fails instead of updating the lock).

## Changing Ask

The refusal text, the prohibited phrases and the distress handling are deliberate behaviour, not incidental. Before touching `backend/app/services/rag.py`, `intent.py` or the prompt:

- read `tests/test_rag_advice_guard.py` and `tests/test_safety_regression.py`;
- keep the output guard replacing the **whole** answer (never partial redaction) and keep failures closed (parse error or timeout returns the refusal);
- add a regression test for any new phrasing you allow or block.

See [Ask pipeline](ARCHITECTURE.md#ask-rag-pipeline) and [Streaming](ARCHITECTURE.md#streaming) for why streamed text must be replaced by the final `done` event.

## Schema changes

No migration tool. Add an idempotent statement to `SCHEMA_RECONCILIATION_STATEMENTS` in `backend/app/db.py` (it runs on every boot). On a table with production rows add constraints as `NOT VALID` so startup cannot fail on existing data. If a column holds a value that moves through three or more states, define the states and allowed transitions once (an enum plus an allowed-edges map) and enforce them in the database too.

## Frontend changes

Read [`frontend/README.md`](../frontend/README.md) first. The rules that are easiest to break:

- No hardcoded `rgba()`/hex in components; use the tokens (both themes).
- Do not add per-component focus styles; the global `:focus-visible` outline is the one indicator.
- Controls are at least 44px; status is never colour alone; tooltips are supplementary and never inside another interactive element.
- After a colour change run `pnpm test` (the contrast test reads `index.css`).
- UI changes are verified in a real browser, not only by jsdom: axe with contrast on in both themes at 1280/390/320px, keyboard Tab-through, and for Ask the streaming scroll checks. jsdom has no layout, so it cannot catch scroll or contrast regressions.
- Screen readers (VoiceOver, NVDA) and 400% zoom are manual and are not covered by CI. List anything you could not verify in the PR.

## Commits

Small, logical commits with a message that says why. Do not commit `.env`, API keys, or generated build output.
