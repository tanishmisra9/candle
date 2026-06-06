from __future__ import annotations

from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.db import get_session
from app.main import app


class DummyScalarResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class DummyExecuteResult:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return DummyScalarResult(self._rows)


class DummyTrialsSession:
    def __init__(self, trials: dict[str, object], publications_by_trial: dict[str, list[object]]):
        self.trials = trials
        self.publications_by_trial = publications_by_trial

    async def scalar(self, stmt):
        trial_id = str(stmt.whereclause.right.value)
        return self.trials.get(trial_id)

    async def execute(self, stmt):
        sql = str(stmt)
        if "FROM publications" in sql:
            trial_id = str(stmt.whereclause.right.value)
            return DummyExecuteResult(self.publications_by_trial.get(trial_id, []))
        return DummyExecuteResult(list(self.trials.values()))


class DummyPublicationsSession:
    def __init__(self, publications: list[object]):
        self.publications = publications

    async def execute(self, stmt):
        return DummyExecuteResult(self.publications)


def override_session(session):
    async def _override():
        yield session

    return _override


def make_guard_settings(**overrides):
    payload = {
        "trust_proxy_headers": False,
        "ask_rate_limit_per_minute": 6,
        "ask_rate_limit_burst": 2,
        "publication_overview_rate_limit_per_minute": 20,
        "publication_overview_rate_limit_burst": 5,
        "read_rate_limit_per_minute": 60,
        "read_rate_limit_burst": 0,
    }
    payload.update(overrides)
    return SimpleNamespace(**payload)


def make_trial(trial_id: str, **overrides):
    payload = {
        "id": trial_id,
        "title": f"Trial {trial_id}",
        "status": "RECRUITING",
        "phase": "PHASE2",
        "start_date": None,
        "completion_date": None,
        "sponsor": "Candle",
        "intervention": "Gene therapy",
        "intervention_type": "GENETIC",
        "enrollment": 12,
        "primary_endpoint": "BCVA",
        "locations": [],
        "contact_email": None,
        "url": f"https://clinicaltrials.gov/study/{trial_id}",
        "ai_summary": None,
        "raw_json": {"protocolSection": {"outcomesModule": {}}},
    }
    payload.update(overrides)
    return SimpleNamespace(**payload)


def make_publication(pmid: str, **overrides):
    payload = {
        "pmid": pmid,
        "trial_id": None,
        "title": f"Publication {pmid}",
        "authors": ["Doe, Jane"],
        "journal": "Journal",
        "pub_date": None,
        "abstract": None,
        "doi": None,
        "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
    }
    payload.update(overrides)
    return SimpleNamespace(**payload)


def test_trials_list_rate_limit_returns_429(monkeypatch):
    trial = make_trial("NCT00000001")
    session = DummyTrialsSession({trial.id: trial}, {})
    app.dependency_overrides[get_session] = override_session(session)
    monkeypatch.setattr(
        "app.services.llm_guardrails.get_settings",
        lambda: make_guard_settings(read_rate_limit_per_minute=1, read_rate_limit_burst=0),
    )
    client = TestClient(app)

    first = client.get("/trials")
    second = client.get("/trials")

    assert first.status_code == 200
    assert second.status_code == 429
    assert second.headers["Retry-After"] == "60"
    assert second.json()["detail"] == "Rate limit exceeded for this endpoint."

    app.dependency_overrides.clear()


def test_trial_detail_rate_limit_returns_429(monkeypatch):
    trial = make_trial("NCT00000002", ai_summary="Summary")
    session = DummyTrialsSession({trial.id: trial}, {trial.id: []})
    app.dependency_overrides[get_session] = override_session(session)
    monkeypatch.setattr(
        "app.services.llm_guardrails.get_settings",
        lambda: make_guard_settings(read_rate_limit_per_minute=1, read_rate_limit_burst=0),
    )
    client = TestClient(app)

    first = client.get(f"/trials/{trial.id}")
    second = client.get(f"/trials/{trial.id}")

    assert first.status_code == 200
    assert second.status_code == 429
    assert second.headers["Retry-After"] == "60"

    app.dependency_overrides.clear()


def test_publications_list_rate_limit_returns_429(monkeypatch):
    publication = make_publication("PMID1")
    session = DummyPublicationsSession([publication])
    app.dependency_overrides[get_session] = override_session(session)
    monkeypatch.setattr(
        "app.services.llm_guardrails.get_settings",
        lambda: make_guard_settings(read_rate_limit_per_minute=1, read_rate_limit_burst=0),
    )
    client = TestClient(app)

    first = client.get("/publications")
    second = client.get("/publications")

    assert first.status_code == 200
    assert second.status_code == 429
    assert second.headers["Retry-After"] == "60"

    app.dependency_overrides.clear()
