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


def override_session(session):
    async def _override():
        yield session

    return _override


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


def make_publication(pmid: str, trial_id: str):
    return SimpleNamespace(
        pmid=pmid,
        trial_id=trial_id,
        title=f"Publication {pmid}",
        authors=["Doe, Jane"],
        journal="Journal",
        pub_date=None,
        abstract=None,
        doi=None,
        url=f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
    )


def test_list_trials_omits_ai_summary():
    trial = make_trial("NCT00000001", ai_summary="Stored summary")
    session = DummyTrialsSession({trial.id: trial}, {})
    app.dependency_overrides[get_session] = override_session(session)
    client = TestClient(app)

    response = client.get("/trials")

    assert response.status_code == 200
    body = response.json()
    assert body[0]["id"] == trial.id
    assert "ai_summary" not in body[0]

    app.dependency_overrides.clear()


def test_get_trial_includes_ai_summary():
    trial = make_trial(
        "NCT00000002",
        ai_summary="A plain-language AI summary for the trial.",
        raw_json={
            "protocolSection": {
                "outcomesModule": {
                    "primaryOutcomes": [
                        {"measure": "Visual acuity", "description": "BCVA", "timeFrame": "12 months"}
                    ]
                }
            }
        },
    )
    publication = make_publication("PMID1", trial.id)
    session = DummyTrialsSession({trial.id: trial}, {trial.id: [publication]})
    app.dependency_overrides[get_session] = override_session(session)
    client = TestClient(app)

    response = client.get(f"/trials/{trial.id}")

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == trial.id
    assert body["ai_summary"] == "A plain-language AI summary for the trial."
    assert body["publications"][0]["pmid"] == publication.pmid
    assert body["outcomes"][0]["measure"] == "Visual acuity"

    app.dependency_overrides.clear()
