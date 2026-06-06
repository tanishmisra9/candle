import pytest

from app.ingest.pubmed import ingest_publications


SAMPLE_ARTICLE_XML = """\
<PubmedArticleSet>
  <PubmedArticle>
    <MedlineCitation>
      <PMID Version="1">12345678</PMID>
      <Article>
        <ArticleTitle>Gene therapy for choroideremia</ArticleTitle>
        <Abstract>
          <AbstractText>Background on CHM gene therapy.</AbstractText>
        </Abstract>
        <AuthorList>
          <Author><LastName>Doe</LastName><ForeName>Jane</ForeName></Author>
        </AuthorList>
        <Journal>
          <Title>Retina Journal</Title>
          <JournalIssue>
            <PubDate>
              <Year>2024</Year>
              <Month>Jan</Month>
              <Day>15</Day>
            </PubDate>
          </JournalIssue>
        </Journal>
        <ELocationID EIdType="doi" ValidYN="Y">10.1000/example</ELocationID>
      </Article>
    </MedlineCitation>
  </PubmedArticle>
</PubmedArticleSet>
"""


class DummySession:
    def __init__(self):
        self.statements = []
        self.commit_calls = 0

    async def execute(self, statement):
        self.statements.append(statement)

    async def commit(self):
        self.commit_calls += 1


class FakeResponse:
    def __init__(self, text: str):
        self.text = text
        self.status_code = 200

    def raise_for_status(self):
        return None


class FakeAsyncClient:
    def __init__(self, fetch_text: str):
        self.fetch_text = fetch_text
        self.calls = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, url, params):
        self.calls.append((url, params))
        return FakeResponse(self.fetch_text)


class FakeExcluded:
    def __getattr__(self, name):
        return name


class FakeInsertStatement:
    def __init__(self):
        self.rows = []
        self.excluded = FakeExcluded()
        self.index_elements = None
        self.set_values = None
        self.where_clause = None

    def values(self, rows):
        self.rows = list(rows)
        return self

    def on_conflict_do_update(self, *, index_elements, set_, where=None):
        self.index_elements = index_elements
        self.set_values = set_
        self.where_clause = where
        return self


@pytest.mark.asyncio
async def test_ingest_publications_upsert_only_updates_when_content_differs(monkeypatch):
    session = DummySession()
    fake_stmt = FakeInsertStatement()
    fake_client = FakeAsyncClient(SAMPLE_ARTICLE_XML)

    async def fake_fetch_pmids(_client):
        return ["12345678"]

    monkeypatch.setattr("app.ingest.pubmed.fetch_pmids", fake_fetch_pmids)
    monkeypatch.setattr(
        "app.ingest.pubmed.httpx.AsyncClient",
        lambda timeout, headers: fake_client,
    )
    monkeypatch.setattr("app.ingest.pubmed.insert", lambda model: fake_stmt)

    count = await ingest_publications(session)

    assert count == 1
    assert fake_stmt.where_clause is not None
    sql = str(fake_stmt.where_clause)
    assert "IS DISTINCT FROM" in sql
    for column in ("title", "authors", "journal", "pub_date", "abstract", "doi", "url"):
        assert f"publications.{column}" in sql
    assert "updated_at" not in sql
    assert "pmid" not in sql
    assert "updated_at" in fake_stmt.set_values
