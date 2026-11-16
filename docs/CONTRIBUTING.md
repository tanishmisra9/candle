# Contributing

Candle is a patient-facing health research tool. Two things outrank everything else: **the Ask safety contract** and **accessibility**. Both have automated checks, and both have parts that only a real browser or a person can verify.

## Setup

See the [README](../README.md#quick-start). In short: `cp .env.example .env`, set `OPENAI_API_KEY`, `make bootstrap`.

## Tests

```bash
# backend (from backend/)
uv run pytest            # everything except `live` tests (no OpenAI calls); a few tests use the
                         # local Postgres (`make up`) and skip themselves without it
uv run pytest -m live    # needs OPENAI_API_KEY, hits the real API

# frontend (from frontend/)
pnpm test                # unit, component, vitest-axe, colour contrast
pnpm run build           # tsc -b && vite build (the typecheck gate)
```

CI checks lockfile drift (`.github/workflows/lockfiles.yml`) and that the version was bumped (`.github/workflows/version.yml`, see [Versioning](#versioning)). It does **not** run tests, so run them locally before pushing.

### Lockfiles

If you edit `backend/pyproject.toml` or `frontend/package.json`, regenerate the matching lockfile **in the same change**: `cd backend && uv lock` / `cd frontend && pnpm install`. CI runs `uv lock --check` and `pnpm install --frozen-lockfile`, and a dependency removed without a regenerated `uv.lock` once broke every backend deploy for a month (the locked install fails instead of updating the lock).

## Versioning

The release number is `version` in `frontend/package.json`: the one source. `vite.config.ts` injects it as `__APP_VERSION__` and the footer shows "Version x.y.z" on every page that has a footer (not Ask). `backend/pyproject.toml` is not kept in sync (it is never shown, and a bump there needs `uv lock`).

Every change that ships bumps it **in the same commit**:

- **major** (2.x to 3.0): a full redesign of the product. The MVP was v1; the November 2026 paper-theme redesign made it v2.
- **minor** (2.2.0 to 2.3.0): a user-visible feature, a new page or flow, or a pipeline change.
- **patch** (2.2.0 to 2.2.1): a fix, polish, refactor or chore.

Lower numbers reset to 0. CI (`.github/scripts/check-version-bump.sh`) fails a push or PR that changes `frontend/src`, `frontend/index.html` or `backend/app` without changing the version; docs, tests, workflows and lockfiles are exempt. The footer test reads `package.json` directly, so a hardcoded footer string fails too.

History before this was numbered retroactively: 1.0 MVP and deploy, 1.1 Ask guardrails and pagination, 1.2 accessibility, 1.3 RAG v2, 1.4 page transitions, 2.0 paper theme and flame hero, 2.1 one-screen landing with /guide and /about, 2.2 mobile menu and stable panels.

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
