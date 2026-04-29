from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.db import get_session
from app.main import app
from app.services.openai_executor import (
    OpenAIServiceUnavailableError,
    OpenAITimeoutError,
)


class DummySession:
    def __init__(self, publications: dict[str, object]):
        self.publications = publications

    async def get(self, model, key):
        return self.publications.get(key)


def override_session(session):
    async def _override():
        yield session

    return _override


def test_publication_overview_404():
    app.dependency_overrides[get_session] = override_session(DummySession({}))
    client = TestClient(app)

    response = client.post("/publications/PMID404/overview")

    assert response.status_code == 404
    assert response.json()["detail"] == "Publication not found"

    app.dependency_overrides.clear()


def test_publication_overview_returns_null_when_abstract_missing(monkeypatch):
    session = DummySession(
        {
            "PMID1": SimpleNamespace(
                pmid="PMID1",
                abstract=None,
            )
        }
    )

    async def _stub_get_or_generate_publication_overview(session, publication, force=False):
        return None, False

    app.dependency_overrides[get_session] = override_session(session)
    monkeypatch.setattr(
        "app.routers.publications.get_or_generate_publication_overview",
        _stub_get_or_generate_publication_overview,
    )
    client = TestClient(app)

    response = client.post("/publications/PMID1/overview")

    assert response.status_code == 200
    assert response.json() == {"overview": None}

    app.dependency_overrides.clear()


def test_publication_overview_returns_summary(monkeypatch):
    session = DummySession(
        {
            "PMID2": SimpleNamespace(
                pmid="PMID2",
                abstract="A gene therapy abstract for choroideremia.",
            )
        }
    )

    async def _stub_get_or_generate_publication_overview(session, publication, force=False):
        assert publication.pmid == "PMID2"
        return "A plain-language overview.", True

    app.dependency_overrides[get_session] = override_session(session)
    monkeypatch.setattr(
        "app.routers.publications.get_or_generate_publication_overview",
        _stub_get_or_generate_publication_overview,
    )
    client = TestClient(app)

    response = client.post("/publications/PMID2/overview")

    assert response.status_code == 200
    assert response.json() == {"overview": "A plain-language overview."}

    app.dependency_overrides.clear()


def test_publication_overview_uses_cached_summary(monkeypatch):
    session = DummySession(
        {
            "PMIDCACHED": SimpleNamespace(
                pmid="PMIDCACHED",
                abstract="A gene therapy abstract for choroideremia.",
            )
        }
    )

    async def _stub_get_or_generate_publication_overview(session, publication, force=False):
        return "Cached overview.", False

    app.dependency_overrides[get_session] = override_session(session)
    monkeypatch.setattr(
        "app.routers.publications.get_or_generate_publication_overview",
        _stub_get_or_generate_publication_overview,
    )
    client = TestClient(app)

    response = client.post("/publications/PMIDCACHED/overview")

    assert response.status_code == 200
    assert response.json() == {"overview": "Cached overview."}

    app.dependency_overrides.clear()


def test_publication_overview_returns_500_when_openai_key_missing(monkeypatch):
    session = DummySession(
        {
            "PMID3": SimpleNamespace(
                pmid="PMID3",
                abstract="Abstract text",
            )
        }
    )

    async def _stub_get_or_generate_publication_overview(session, publication, force=False):
        raise RuntimeError(
            "OPENAI_API_KEY is required for publication overview generation."
        )

    app.dependency_overrides[get_session] = override_session(session)
    monkeypatch.setattr(
        "app.routers.publications.get_or_generate_publication_overview",
        _stub_get_or_generate_publication_overview,
    )
    client = TestClient(app)

    response = client.post("/publications/PMID3/overview")

    assert response.status_code == 500
    assert response.json()["detail"] == "OPENAI_API_KEY is required for publication overview generation."

    app.dependency_overrides.clear()


def test_publication_overview_returns_503_when_openai_fails(monkeypatch):
    session = DummySession(
        {
            "PMID4": SimpleNamespace(
                pmid="PMID4",
                abstract="Abstract text",
            )
        }
    )

    async def _stub_get_or_generate_publication_overview(session, publication, force=False):
        raise OpenAIServiceUnavailableError("OpenAI request failed.")

    app.dependency_overrides[get_session] = override_session(session)
    monkeypatch.setattr(
        "app.routers.publications.get_or_generate_publication_overview",
        _stub_get_or_generate_publication_overview,
    )
    client = TestClient(app)

    response = client.post("/publications/PMID4/overview")

    assert response.status_code == 503
    assert response.json()["detail"] == "Publication overview service is temporarily unavailable."

    app.dependency_overrides.clear()


def test_publication_overview_returns_504_when_openai_times_out(monkeypatch):
    session = DummySession(
        {
            "PMID5": SimpleNamespace(
                pmid="PMID5",
                abstract="Abstract text",
            )
        }
    )

    async def _stub_get_or_generate_publication_overview(session, publication, force=False):
        raise OpenAITimeoutError("OpenAI request timed out.")

    app.dependency_overrides[get_session] = override_session(session)
    monkeypatch.setattr(
        "app.routers.publications.get_or_generate_publication_overview",
        _stub_get_or_generate_publication_overview,
    )
    client = TestClient(app)

    response = client.post("/publications/PMID5/overview")

    assert response.status_code == 504
    assert response.json()["detail"] == "Publication overview timed out."

    app.dependency_overrides.clear()
