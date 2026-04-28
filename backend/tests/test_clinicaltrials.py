import pytest

from app.ingest.clinicaltrials import ingest_trials, raw_study_is_chm_related, study_to_row


def make_study(
    nct_id: str,
    brief_title: str = "Example trial",
    conditions: list[object] | None = None,
    keywords: list[object] | None = None,
    official_title: object | None = None,
    brief_summary: object | None = None,
    detailed_description: object | None = None,
) -> dict:
    protocol_section = {
        "identificationModule": {
            "nctId": nct_id,
            "briefTitle": brief_title,
        },
        "statusModule": {
            "overallStatus": "RECRUITING",
            "startDateStruct": {"date": "2024-01-15"},
            "completionDateStruct": {"date": "2025-12"},
        },
        "designModule": {
            "phases": ["PHASE2"],
            "enrollmentInfo": {"count": 12},
        },
        "sponsorCollaboratorsModule": {"leadSponsor": {"name": "Example Sponsor"}},
        "armsInterventionsModule": {
            "interventions": [{"type": "GENETIC", "name": "Example Therapy"}]
        },
        "outcomesModule": {"primaryOutcomes": [{"measure": "BCVA"}]},
        "contactsLocationsModule": {
            "centralContacts": [{"email": "contact@example.com"}],
            "locations": [
                {
                    "facility": "Vision Institute",
                    "status": "RECRUITING",
                    "city": "Boston",
                    "country": "United States",
                }
            ],
        },
    }
    if conditions is not None or keywords is not None:
        protocol_section["conditionsModule"] = {}
        if conditions is not None:
            protocol_section["conditionsModule"]["conditions"] = conditions
        if keywords is not None:
            protocol_section["conditionsModule"]["keywords"] = keywords
    if official_title is not None:
        protocol_section["identificationModule"]["officialTitle"] = official_title
    if brief_summary is not None or detailed_description is not None:
        protocol_section["descriptionModule"] = {}
        if brief_summary is not None:
            protocol_section["descriptionModule"]["briefSummary"] = brief_summary
        if detailed_description is not None:
            protocol_section["descriptionModule"]["detailedDescription"] = detailed_description
    return {"protocolSection": protocol_section}


def test_study_to_row_handles_flat_location_shape():
    study = make_study("NCT12345678", brief_title="Example CHM Trial")

    row = study_to_row(study)

    assert row is not None
    assert row["id"] == "NCT12345678"
    assert row["locations"] == [
        {
            "facility": "Vision Institute",
            "city": "Boston",
            "country": "United States",
            "status": "RECRUITING",
        }
    ]
    assert row["contact_email"] == "contact@example.com"


def test_raw_study_is_chm_related_matches_conditions():
    study = make_study(
        "NCT10000001",
        conditions=["Inherited retinal disease", "Choroideremia"],
    )

    assert raw_study_is_chm_related(study) is True


def test_raw_study_is_chm_related_matches_full_detailed_description():
    long_description = (
        "This study collects extensive background details. " * 50
        + "The target population includes people with choroideremia."
    )
    study = make_study("NCT10000002", detailed_description=long_description)

    assert raw_study_is_chm_related(study) is True


def test_raw_study_is_chm_related_matches_title_and_summary_fields():
    title_study = make_study(
        "NCT10000003",
        official_title="Natural history study in choroideremia",
    )
    summary_study = make_study(
        "NCT10000004",
        brief_summary="Observational registry for people with Choroideremia.",
    )

    assert raw_study_is_chm_related(title_study) is True
    assert raw_study_is_chm_related(summary_study) is True


def test_raw_study_is_chm_related_rejects_acronym_only_and_unrelated_content():
    study = make_study(
        "NCT10000005",
        brief_title="Aerobic exercise and CHM source tracking",
        conditions=["Cerebral hemodynamics"],
        keywords=["CHM", "exercise physiology"],
        brief_summary="This trial references CHM as a data source acronym only.",
        detailed_description="The protocol focuses on cerebral hemodynamics in athletes.",
    )

    assert raw_study_is_chm_related(study) is False


def test_raw_study_is_chm_related_handles_missing_and_malformed_fields():
    study = {
        "protocolSection": {
            "conditionsModule": {
                "conditions": ["Retinal disease", None, {"label": "Choroideremia"}],
                "keywords": "choroideremia",
            },
            "identificationModule": {"briefTitle": None, "officialTitle": {"text": "bad shape"}},
            "descriptionModule": {"briefSummary": ["wrong"], "detailedDescription": None},
        }
    }

    assert raw_study_is_chm_related(study) is False


class DummySession:
    def __init__(self):
        self.statements = []
        self.commit_calls = 0

    async def execute(self, statement):
        self.statements.append(statement)

    async def commit(self):
        self.commit_calls += 1


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self.payload


class FakeAsyncClient:
    def __init__(self, payloads):
        self.payloads = list(payloads)
        self.calls = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, url, params):
        self.calls.append((url, params))
        return FakeResponse(self.payloads.pop(0))


class FakeExcluded:
    def __getattr__(self, name):
        return name


class FakeInsertStatement:
    def __init__(self):
        self.rows = []
        self.excluded = FakeExcluded()
        self.index_elements = None
        self.set_values = None

    def values(self, rows):
        self.rows = list(rows)
        return self

    def on_conflict_do_update(self, *, index_elements, set_):
        self.index_elements = index_elements
        self.set_values = set_
        return self


@pytest.mark.asyncio
async def test_ingest_trials_skips_irrelevant_raw_studies(monkeypatch):
    relevant_study = make_study(
        "NCT20000001",
        brief_title="Gene therapy for choroideremia",
    )
    irrelevant_study = make_study(
        "NCT20000002",
        brief_title="Aerobic exercise and CHM source tracking",
        conditions=["Cerebral hemodynamics"],
        keywords=["CHM"],
        detailed_description="This trial studies aerobic exercise performance.",
    )
    session = DummySession()
    fake_client = FakeAsyncClient([{"studies": [relevant_study, irrelevant_study]}])
    fake_stmt = FakeInsertStatement()

    monkeypatch.setattr(
        "app.ingest.clinicaltrials.httpx.AsyncClient",
        lambda timeout: fake_client,
    )
    monkeypatch.setattr("app.ingest.clinicaltrials.insert", lambda model: fake_stmt)

    count = await ingest_trials(session)

    assert count == 1
    assert session.commit_calls == 1
    assert len(session.statements) == 1
    assert [row["id"] for row in fake_stmt.rows] == ["NCT20000001"]
