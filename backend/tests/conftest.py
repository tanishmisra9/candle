import pytest


@pytest.fixture(autouse=True)
def stub_schema_reconciliation(monkeypatch):
    async def _noop():
        return None

    monkeypatch.setattr("app.main.reconcile_database_schema", _noop)


@pytest.fixture(autouse=True)
def reset_llm_protection_state():
    from app.services.llm_guardrails import reset_llm_protection_state

    reset_llm_protection_state()
    yield
    reset_llm_protection_state()
