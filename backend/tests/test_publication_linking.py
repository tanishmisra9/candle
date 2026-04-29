from __future__ import annotations

from dataclasses import dataclass

import pytest

from app.ingest.link import link_publications_to_trials


class DummyScalarResult:
    def __init__(self, values):
        self._values = values

    def all(self):
        return self._values


class DummyExecuteResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


@dataclass
class PublicationRecord:
    pmid: str
    title: str | None
    abstract: str | None
    trial_id: str | None


class DummyLinkSession:
    def __init__(
        self,
        trial_ids: list[str],
        publications: list[PublicationRecord],
        *,
        fail_on_update_pmid: str | None = None,
    ):
        self.trial_ids = trial_ids
        self.publications = {publication.pmid: publication for publication in publications}
        self.pending_updates: dict[str, str | None] = {}
        self.fail_on_update_pmid = fail_on_update_pmid
        self.commit_calls = 0
        self.rollback_calls = 0

    async def scalars(self, stmt):
        return DummyScalarResult(self.trial_ids)

    async def execute(self, stmt):
        sql = str(stmt)
        params = stmt.compile().params

        if sql.startswith("SELECT publications.pmid"):
            after_pmid = params.get("pmid_1")
            limit = params.get("param_1") or params.get("limit_1")
            rows = []
            for publication in sorted(self.publications.values(), key=lambda item: item.pmid):
                if after_pmid is not None and publication.pmid <= after_pmid:
                    continue
                current_trial_id = self.pending_updates.get(
                    publication.pmid, publication.trial_id
                )
                rows.append(
                    (
                        publication.pmid,
                        publication.title,
                        publication.abstract,
                        current_trial_id,
                    )
                )
            if limit is not None:
                rows = rows[:limit]
            return DummyExecuteResult(rows)

        if sql.startswith("UPDATE publications SET trial_id"):
            pmid = params["pmid_1"]
            next_trial_id = params.get("trial_id")
            if self.fail_on_update_pmid == pmid:
                raise RuntimeError("link update failed")
            self.pending_updates[pmid] = next_trial_id
            return DummyExecuteResult([])

        raise AssertionError(f"Unexpected statement: {sql}")

    async def commit(self):
        for pmid, trial_id in self.pending_updates.items():
            self.publications[pmid].trial_id = trial_id
        self.pending_updates.clear()
        self.commit_calls += 1

    async def rollback(self):
        self.pending_updates.clear()
        self.rollback_calls += 1


def make_publication(pmid: str, title: str, abstract: str | None, trial_id: str | None):
    return PublicationRecord(pmid=pmid, title=title, abstract=abstract, trial_id=trial_id)


@pytest.mark.asyncio
async def test_link_publications_to_trials_updates_and_clears_stale_links(monkeypatch):
    monkeypatch.setattr("app.ingest.link.PUBLICATION_PAGE_SIZE", 2)
    session = DummyLinkSession(
        ["NCT00000001", "NCT00000002"],
        [
            make_publication(
                "PMID1",
                "Study for NCT00000001",
                "Abstract without extra IDs",
                None,
            ),
            make_publication(
                "PMID2",
                "No linked trial anymore",
                "Nothing useful here",
                "NCT00000002",
            ),
            make_publication(
                "PMID3",
                "Study for NCT00000002",
                "Abstract without extra IDs",
                "NCT00000002",
            ),
        ],
    )

    linked_count = await link_publications_to_trials(session)

    assert linked_count == 2
    assert session.commit_calls == 1
    assert session.rollback_calls == 0
    assert session.publications["PMID1"].trial_id == "NCT00000001"
    assert session.publications["PMID2"].trial_id is None
    assert session.publications["PMID3"].trial_id == "NCT00000002"


@pytest.mark.asyncio
async def test_link_publications_to_trials_rolls_back_on_failure(monkeypatch):
    monkeypatch.setattr("app.ingest.link.PUBLICATION_PAGE_SIZE", 2)
    session = DummyLinkSession(
        ["NCT00000001", "NCT00000002"],
        [
            make_publication("PMID1", "Study for NCT00000001", None, None),
            make_publication("PMID2", "Study for NCT00000002", None, "NCT00000001"),
        ],
        fail_on_update_pmid="PMID2",
    )

    with pytest.raises(RuntimeError, match="link update failed"):
        await link_publications_to_trials(session)

    assert session.commit_calls == 0
    assert session.rollback_calls == 1
    assert session.publications["PMID1"].trial_id is None
    assert session.publications["PMID2"].trial_id == "NCT00000001"
