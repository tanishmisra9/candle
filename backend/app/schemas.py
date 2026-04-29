from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class OutcomeEntry(BaseModel):
    outcome_type: str
    measure: str
    description: str | None = None
    timeframe: str | None = None


class PublicationSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    pmid: str
    trial_id: str | None = None
    title: str
    authors: list[str] = Field(default_factory=list)
    journal: str | None = None
    pub_date: date | None = None
    abstract: str | None = None
    doi: str | None = None
    url: str


class PublicationOverviewResponse(BaseModel):
    overview: str | None


class PublicationCursorPage(BaseModel):
    items: list["PublicationSummary"] = Field(default_factory=list)
    next_cursor: str | None = None


class TrialSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    status: str | None = None
    phase: str | None = None
    start_date: date | None = None
    completion_date: date | None = None
    sponsor: str | None = None
    intervention: str | None = None
    intervention_type: str | None = None
    enrollment: int | None = None
    primary_endpoint: str | None = None
    locations: list[dict[str, Any]] = Field(default_factory=list)
    contact_email: str | None = None
    url: str


class TrialDetail(TrialSummary):
    ai_summary: str | None = None
    publications: list[PublicationSummary] = Field(default_factory=list)
    outcomes: list[OutcomeEntry] = Field(default_factory=list)


class TrialCursorPage(BaseModel):
    items: list[TrialSummary] = Field(default_factory=list)
    next_cursor: str | None = None


class SyncLogEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    started_at: datetime
    finished_at: datetime | None = None
    trials_ingested: int | None = None
    publications_ingested: int | None = None
    publications_linked: int | None = None
    embeddings_stored: int | None = None
    summaries_generated: int | None = None
    status: str | None = None
    error_message: str | None = None


class AskRequest(BaseModel):
    question: str


class AskSource(BaseModel):
    source_type: Literal["trial", "publication"]
    source_id: str
    title: str
    url: str | None = None
    label: str | None = None
    detail: str | None = None


class AskResponse(BaseModel):
    answer: str
    sources: list[AskSource]
