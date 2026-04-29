from __future__ import annotations

from datetime import date
from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.db import get_session
from app.main import app
from app.routers.publications import (
    encode_publication_cursor,
    publication_filter_signature,
)
from app.routers.trials import encode_trial_cursor, trial_filter_signature


class DummyScalarResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class DummyExecuteResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows

    def scalars(self):
        return DummyScalarResult(self._rows)


class DummyTrialCursorSession:
    def __init__(self, trials: list[object]):
        self.trials = trials

    async def execute(self, stmt):
        sql = str(stmt)
        params = stmt.compile().params
        rows = list(self.trials)

        status = params.get("lower_1")
        if status:
            rows = [trial for trial in rows if (trial.status or "").lower() == status]

        sponsor = params.get("sponsor_1")
        if sponsor:
            needle = sponsor.strip("%").lower()
            rows = [trial for trial in rows if needle in (trial.sponsor or "").lower()]

        title_query = params.get("title_1")
        if title_query:
            needle = title_query.strip("%").lower()
            rows = [trial for trial in rows if needle in trial.title.lower()]

        def sort_date(trial):
            return trial.start_date or trial.completion_date

        if "ORDER BY sort_date DESC NULLS LAST, trials.id ASC" in sql:
            cursor_date = params.get("param_1")
            cursor_id = params.get("id_1")
            if cursor_id is not None:
                if cursor_date is None:
                    rows = [
                        trial
                        for trial in rows
                        if sort_date(trial) is None and trial.id > cursor_id
                    ]
                else:
                    rows = [
                        trial
                        for trial in rows
                        if sort_date(trial) is None
                        or sort_date(trial) < cursor_date
                        or (sort_date(trial) == cursor_date and trial.id > cursor_id)
                    ]

            rows.sort(
                key=lambda trial: (
                    sort_date(trial) is None,
                    -(sort_date(trial).toordinal()) if sort_date(trial) else 0,
                    trial.id,
                )
            )
            limit = next(value for value in reversed(list(params.values())) if isinstance(value, int))
            page = [(trial, sort_date(trial)) for trial in rows[:limit]]
            return DummyExecuteResult(page)

        rows.sort(
            key=lambda trial: (
                sort_date(trial) is None,
                -(sort_date(trial).toordinal()) if sort_date(trial) else 0,
                trial.title,
            )
        )
        limit = params["param_1"]
        return DummyExecuteResult(rows[:limit])


class DummyPublicationCursorSession:
    def __init__(self, publications: list[object]):
        self.publications = publications

    async def execute(self, stmt):
        sql = str(stmt)
        params = stmt.compile().params
        rows = list(self.publications)

        trial_id = params.get("trial_id_1")
        if trial_id:
            rows = [publication for publication in rows if publication.trial_id == trial_id]

        title_query = params.get("title_1")
        abstract_query = params.get("abstract_1")
        if title_query or abstract_query:
            needle = (title_query or abstract_query or "").strip("%").lower()
            rows = [
                publication
                for publication in rows
                if needle in publication.title.lower()
                or needle in (publication.abstract or "").lower()
            ]

        if "ORDER BY publications.pub_date DESC NULLS LAST, publications.pmid ASC" in sql:
            cursor_date = params.get("pub_date_1")
            cursor_pmid = params.get("pmid_1")
            if cursor_pmid is not None:
                if cursor_date is None:
                    rows = [
                        publication
                        for publication in rows
                        if publication.pub_date is None and publication.pmid > cursor_pmid
                    ]
                else:
                    rows = [
                        publication
                        for publication in rows
                        if publication.pub_date is None
                        or publication.pub_date < cursor_date
                        or (
                            publication.pub_date == cursor_date
                            and publication.pmid > cursor_pmid
                        )
                    ]

            rows.sort(
                key=lambda publication: (
                    publication.pub_date is None,
                    -(publication.pub_date.toordinal()) if publication.pub_date else 0,
                    publication.pmid,
                )
            )
            limit = next(value for value in reversed(list(params.values())) if isinstance(value, int))
            return DummyExecuteResult(rows[:limit])

        rows.sort(
            key=lambda publication: (
                publication.pub_date is None,
                -(publication.pub_date.toordinal()) if publication.pub_date else 0,
                publication.title,
            )
        )
        limit = params["param_1"]
        return DummyExecuteResult(rows[:limit])


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


def test_trials_cursor_progression_and_filtering():
    trials = [
        make_trial("NCT00000003", title="Gamma trial", start_date=date(2024, 2, 1)),
        make_trial("NCT00000001", title="Alpha trial", start_date=date(2024, 3, 1)),
        make_trial(
            "NCT00000002",
            title="Beta gene trial",
            start_date=date(2024, 3, 1),
            sponsor="Biogen",
        ),
    ]
    session = DummyTrialCursorSession(trials)
    app.dependency_overrides[get_session] = override_session(session)
    client = TestClient(app)

    response = client.get("/trials", params={"envelope": "true", "limit": 2})

    assert response.status_code == 200
    body = response.json()
    assert [item["id"] for item in body["items"]] == ["NCT00000001", "NCT00000002"]
    assert body["next_cursor"] == encode_trial_cursor(
        date(2024, 3, 1),
        "NCT00000002",
        trial_filter_signature(
            status=None,
            phase=None,
            intervention_type=None,
            sponsor=None,
            q=None,
            limit=2,
        ),
    )

    next_page = client.get(
        "/trials",
        params={"cursor": body["next_cursor"], "limit": 2},
    )
    assert next_page.status_code == 200
    assert [item["id"] for item in next_page.json()["items"]] == ["NCT00000003"]

    filtered = client.get(
        "/trials",
        params={"envelope": "true", "q": "gene", "sponsor": "biogen", "limit": 2},
    )
    assert filtered.status_code == 200
    assert [item["id"] for item in filtered.json()["items"]] == ["NCT00000002"]

    app.dependency_overrides.clear()


def test_trials_reject_invalid_cursor():
    session = DummyTrialCursorSession([make_trial("NCT00000001")])
    app.dependency_overrides[get_session] = override_session(session)
    client = TestClient(app)

    response = client.get("/trials", params={"cursor": "not-a-cursor"})

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid cursor."

    app.dependency_overrides.clear()


def test_trials_reject_cursor_with_mismatched_filters():
    session = DummyTrialCursorSession([make_trial("NCT00000001", sponsor="Biogen")])
    app.dependency_overrides[get_session] = override_session(session)
    client = TestClient(app)
    cursor = encode_trial_cursor(
        date(2024, 3, 1),
        "NCT00000001",
        trial_filter_signature(
            status=None,
            phase=None,
            intervention_type=None,
            sponsor="Biogen",
            q=None,
            limit=100,
        ),
    )

    response = client.get("/trials", params={"cursor": cursor, "sponsor": "Candle"})

    assert response.status_code == 400
    assert response.json()["detail"] == "Cursor does not match the current filters."

    app.dependency_overrides.clear()


def test_trials_reject_cursor_with_mismatched_limit():
    session = DummyTrialCursorSession([make_trial("NCT00000001")])
    app.dependency_overrides[get_session] = override_session(session)
    client = TestClient(app)
    cursor = encode_trial_cursor(
        date(2024, 3, 1),
        "NCT00000001",
        trial_filter_signature(
            status=None,
            phase=None,
            intervention_type=None,
            sponsor=None,
            q=None,
            limit=2,
        ),
    )

    response = client.get("/trials", params={"cursor": cursor, "limit": 3})

    assert response.status_code == 400
    assert response.json()["detail"] == "Cursor does not match the current filters."

    app.dependency_overrides.clear()


def test_publications_cursor_progression_and_filtering():
    publications = [
        make_publication("PMID3", title="Zeta", pub_date=date(2024, 1, 1)),
        make_publication(
            "PMID1",
            title="Alpha gene therapy",
            pub_date=date(2024, 3, 1),
            abstract="CHM gene therapy abstract",
            trial_id="NCT1",
        ),
        make_publication(
            "PMID2",
            title="Beta natural history",
            pub_date=date(2024, 3, 1),
            abstract="Natural history abstract",
            trial_id="NCT2",
        ),
    ]
    session = DummyPublicationCursorSession(publications)
    app.dependency_overrides[get_session] = override_session(session)
    client = TestClient(app)

    response = client.get("/publications", params={"envelope": "true", "limit": 2})

    assert response.status_code == 200
    body = response.json()
    assert [item["pmid"] for item in body["items"]] == ["PMID1", "PMID2"]
    assert body["next_cursor"] == encode_publication_cursor(
        date(2024, 3, 1),
        "PMID2",
        publication_filter_signature(trial_id=None, q=None, limit=2),
    )

    next_page = client.get(
        "/publications",
        params={"cursor": body["next_cursor"], "limit": 2},
    )
    assert next_page.status_code == 200
    assert [item["pmid"] for item in next_page.json()["items"]] == ["PMID3"]

    filtered = client.get(
        "/publications",
        params={"envelope": "true", "trial_id": "NCT1", "q": "gene", "limit": 2},
    )
    assert filtered.status_code == 200
    assert [item["pmid"] for item in filtered.json()["items"]] == ["PMID1"]

    app.dependency_overrides.clear()


def test_publications_reject_invalid_cursor():
    session = DummyPublicationCursorSession([make_publication("PMID1")])
    app.dependency_overrides[get_session] = override_session(session)
    client = TestClient(app)

    response = client.get("/publications", params={"cursor": "bad-cursor"})

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid cursor."

    app.dependency_overrides.clear()


def test_publications_reject_cursor_with_mismatched_filters():
    session = DummyPublicationCursorSession(
        [make_publication("PMID1", trial_id="NCT1", title="Gene study")]
    )
    app.dependency_overrides[get_session] = override_session(session)
    client = TestClient(app)
    cursor = encode_publication_cursor(
        date(2024, 3, 1),
        "PMID1",
        publication_filter_signature(trial_id="NCT1", q="gene", limit=200),
    )

    response = client.get("/publications", params={"cursor": cursor, "trial_id": "NCT2", "q": "gene"})

    assert response.status_code == 400
    assert response.json()["detail"] == "Cursor does not match the current filters."

    app.dependency_overrides.clear()


def test_publications_reject_cursor_with_mismatched_limit():
    session = DummyPublicationCursorSession([make_publication("PMID1")])
    app.dependency_overrides[get_session] = override_session(session)
    client = TestClient(app)
    cursor = encode_publication_cursor(
        date(2024, 3, 1),
        "PMID1",
        publication_filter_signature(trial_id=None, q=None, limit=2),
    )

    response = client.get("/publications", params={"cursor": cursor, "limit": 3})

    assert response.status_code == 400
    assert response.json()["detail"] == "Cursor does not match the current filters."

    app.dependency_overrides.clear()
