from __future__ import annotations

import asyncio
import calendar
from datetime import date
from itertools import islice
from typing import Iterable
from xml.etree import ElementTree as ET

import httpx
from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import Publication


settings = get_settings()
MONTH_LOOKUP = {name.lower(): idx for idx, name in enumerate(calendar.month_abbr) if name}
MONTH_LOOKUP.update({name.lower(): idx for idx, name in enumerate(calendar.month_name) if name})


def batched(iterable: list[str], size: int) -> Iterable[list[str]]:
    iterator = iter(iterable)
    while batch := list(islice(iterator, size)):
        yield batch


def parse_pub_date(article: ET.Element) -> date | None:
    pub_date = article.find(".//JournalIssue/PubDate")
    if pub_date is None:
        return None

    year_text = pub_date.findtext("Year")
    month_text = pub_date.findtext("Month")
    day_text = pub_date.findtext("Day")
    medline_text = pub_date.findtext("MedlineDate")

    year = int(year_text) if year_text and year_text.isdigit() else None
    month = 1
    day = 1

    if month_text:
        month = MONTH_LOOKUP.get(month_text.strip().lower(), 1)
    if day_text and day_text.isdigit():
        day = int(day_text)

    if year:
        try:
            return date(year, month, day)
        except ValueError:
            return date(year, month, 1)

    if medline_text:
        parts = medline_text.split()
        for part in parts:
            if part.isdigit() and len(part) == 4:
                return date(int(part), 1, 1)
    return None


def parse_article(article: ET.Element) -> dict[str, object] | None:
    pmid = article.findtext(".//PMID")
    title = "".join(article.find(".//ArticleTitle").itertext()).strip() if article.find(".//ArticleTitle") is not None else None
    if not pmid or not title:
        return None

    abstract_parts = []
    for node in article.findall(".//Abstract/AbstractText"):
        label = node.attrib.get("Label")
        text = "".join(node.itertext()).strip()
        if not text:
            continue
        abstract_parts.append(f"{label}: {text}" if label else text)

    authors = []
    for author in article.findall(".//AuthorList/Author"):
        collective = author.findtext("CollectiveName")
        if collective:
            authors.append(collective)
            continue
        last_name = author.findtext("LastName")
        fore_name = author.findtext("ForeName")
        if last_name and fore_name:
            authors.append(f"{last_name}, {fore_name}")
        elif last_name:
            authors.append(last_name)

    doi = None
    for article_id in article.findall(".//PubmedData/ArticleIdList/ArticleId"):
        if article_id.attrib.get("IdType") == "doi":
            doi = (article_id.text or "").strip() or None
            if doi:
                break

    return {
        "pmid": pmid,
        "title": title,
        "authors": authors,
        "journal": article.findtext(".//Journal/Title"),
        "pub_date": parse_pub_date(article),
        "abstract": "\n\n".join(abstract_parts) or None,
        "doi": doi,
        "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
    }


async def fetch_pmids(client: httpx.AsyncClient) -> list[str]:
    params = {
        "db": "pubmed",
        "term": 'choroideremia[MeSH] OR "CHM gene therapy"',
        "retmax": 500,
    }
    response = await client.get(settings.pubmed_search_url, params=params)
    response.raise_for_status()
    root = ET.fromstring(response.text)
    return [node.text.strip() for node in root.findall(".//IdList/Id") if node.text]


async def ingest_publications(session: AsyncSession) -> int:
    headers = {"User-Agent": settings.ncbi_user_agent}
    all_rows: list[dict[str, object]] = []

    async with httpx.AsyncClient(timeout=30.0, headers=headers) as client:
        pmids = await fetch_pmids(client)

        for batch in batched(pmids, 50):
            params = {
                "db": "pubmed",
                "id": ",".join(batch),
                "rettype": "abstract",
                "retmode": "xml",
            }
            response = await client.get(settings.pubmed_fetch_url, params=params)
            response.raise_for_status()
            root = ET.fromstring(response.text)
            for article in root.findall(".//PubmedArticle"):
                row = parse_article(article)
                if row:
                    all_rows.append(row)
            await asyncio.sleep(0.35)

    if not all_rows:
        return 0

    stmt = insert(Publication).values(all_rows)
    upsert = stmt.on_conflict_do_update(
        index_elements=[Publication.pmid],
        set_={
            "title": stmt.excluded.title,
            "authors": stmt.excluded.authors,
            "journal": stmt.excluded.journal,
            "pub_date": stmt.excluded.pub_date,
            "abstract": stmt.excluded.abstract,
            "doi": stmt.excluded.doi,
            "url": stmt.excluded.url,
            "updated_at": func.now(),
        },
    )
    await session.execute(upsert)
    await session.commit()
    return len(all_rows)
