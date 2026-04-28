from __future__ import annotations

import asyncio
import importlib.util
from pathlib import Path


SCRIPT_PATH = Path(__file__).resolve().parents[1] / "scripts" / "cleanup_non_chm_trials.py"


def load_cleanup_module():
    spec = importlib.util.spec_from_file_location("cleanup_non_chm_trials", SCRIPT_PATH)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class FakeResult:
    def __init__(self, *, rowcount: int | None = None, scalar_value: int | None = None):
        self.rowcount = rowcount
        self._scalar_value = scalar_value

    def scalar_one(self):
        if self._scalar_value is None:
            raise AssertionError("scalar_one() called without a configured scalar value")
        return self._scalar_value


class FakeSession:
    def __init__(self, results: list[FakeResult]):
        self.results = list(results)
        self.statements: list[str] = []
        self.commit_calls = 0

    async def execute(self, statement):
        self.statements.append(str(statement))
        if not self.results:
            raise AssertionError("No fake result configured for execute()")
        return self.results.pop(0)

    async def commit(self):
        self.commit_calls += 1


class FakeSessionContext:
    def __init__(self, session: FakeSession):
        self.session = session

    async def __aenter__(self):
        return self.session

    async def __aexit__(self, exc_type, exc, tb):
        return False


class FakeSessionFactory:
    def __init__(self, session: FakeSession):
        self.session = session

    def __call__(self):
        return FakeSessionContext(self.session)


def test_cleanup_non_chm_trials_dry_run_uses_count_query(capsys, monkeypatch):
    module = load_cleanup_module()
    session = FakeSession([FakeResult(scalar_value=4)])

    monkeypatch.setattr(module, "AsyncSessionLocal", FakeSessionFactory(session))

    asyncio.run(module.main(dry_run=True))

    output = capsys.readouterr().out
    assert "Would delete 4 non-CHM trials." in output
    assert session.commit_calls == 0
    assert len(session.statements) == 1
    assert session.statements[0] == module.DRY_RUN_COUNT_SQL
    assert module.NON_CHM_WHERE_CLAUSE in session.statements[0]


def test_cleanup_non_chm_trials_deletes_trials_then_embeddings(capsys, monkeypatch):
    module = load_cleanup_module()
    session = FakeSession([FakeResult(rowcount=3), FakeResult(rowcount=7)])

    monkeypatch.setattr(module, "AsyncSessionLocal", FakeSessionFactory(session))

    asyncio.run(module.main())

    output = capsys.readouterr().out
    assert "Deleted 3 non-CHM trials." in output
    assert "Deleted 7 stale trial embeddings." in output
    assert session.commit_calls == 2
    assert len(session.statements) == 2
    assert session.statements[0] == module.DELETE_NON_CHM_TRIALS_SQL
    assert module.NON_CHM_WHERE_CLAUSE in session.statements[0]
    assert "DELETE FROM trials" in session.statements[0]
    assert session.statements[1] == module.DELETE_ORPHANED_TRIAL_EMBEDDINGS_SQL
    assert "source_type = 'trial'" in session.statements[1]
    assert "source_id NOT IN (SELECT id FROM trials)" in session.statements[1]


def test_cleanup_non_chm_trials_is_safe_when_nothing_matches(capsys, monkeypatch):
    module = load_cleanup_module()
    session = FakeSession([FakeResult(rowcount=0), FakeResult(rowcount=0)])

    monkeypatch.setattr(module, "AsyncSessionLocal", FakeSessionFactory(session))

    asyncio.run(module.main())

    output = capsys.readouterr().out
    assert "Deleted 0 non-CHM trials." in output
    assert "Deleted 0 stale trial embeddings." in output
    assert session.commit_calls == 2
