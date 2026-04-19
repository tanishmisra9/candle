import pytest


@pytest.fixture(autouse=True)
def stub_schema_reconciliation(monkeypatch):
    async def _noop():
        return None

    monkeypatch.setattr("app.main.reconcile_database_schema", _noop)
