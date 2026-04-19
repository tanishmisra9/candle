from __future__ import annotations

from datetime import date, datetime
from typing import Any

from pgvector.sqlalchemy import VECTOR
from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Trial(Base):
    __tablename__ = "trials"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str | None] = mapped_column(Text)
    phase: Mapped[str | None] = mapped_column(Text)
    start_date: Mapped[date | None] = mapped_column(Date)
    completion_date: Mapped[date | None] = mapped_column(Date)
    sponsor: Mapped[str | None] = mapped_column(Text)
    intervention: Mapped[str | None] = mapped_column(Text)
    intervention_type: Mapped[str | None] = mapped_column(Text)
    enrollment: Mapped[int | None] = mapped_column(Integer)
    primary_endpoint: Mapped[str | None] = mapped_column(Text)
    ai_summary: Mapped[str | None] = mapped_column(Text)
    ai_summary_generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    locations: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list)
    contact_email: Mapped[str | None] = mapped_column(Text)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    raw_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    publications: Mapped[list["Publication"]] = relationship(back_populates="trial")
    outcomes: Mapped[list["Outcome"]] = relationship(back_populates="trial")


class Publication(Base):
    __tablename__ = "publications"

    pmid: Mapped[str] = mapped_column(Text, primary_key=True)
    trial_id: Mapped[str | None] = mapped_column(ForeignKey("trials.id", ondelete="SET NULL"))
    title: Mapped[str] = mapped_column(Text, nullable=False)
    authors: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    journal: Mapped[str | None] = mapped_column(Text)
    pub_date: Mapped[date | None] = mapped_column(Date)
    abstract: Mapped[str | None] = mapped_column(Text)
    doi: Mapped[str | None] = mapped_column(Text)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    trial: Mapped[Trial | None] = relationship(back_populates="publications")


class Outcome(Base):
    __tablename__ = "outcomes"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    trial_id: Mapped[str] = mapped_column(ForeignKey("trials.id", ondelete="CASCADE"))
    outcome_type: Mapped[str] = mapped_column(String, nullable=False)
    measure: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    timeframe: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    trial: Mapped[Trial] = relationship(back_populates="outcomes")


class Embedding(Base):
    __tablename__ = "embeddings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    source_type: Mapped[str] = mapped_column(String, nullable=False)
    source_id: Mapped[str] = mapped_column(Text, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    chunk_metadata: Mapped[dict[str, Any]] = mapped_column("metadata", JSONB, default=dict)
    embedding: Mapped[list[float]] = mapped_column(VECTOR(1536), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class SyncLog(Base):
    __tablename__ = "sync_log"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    trials_ingested: Mapped[int | None] = mapped_column(Integer)
    publications_ingested: Mapped[int | None] = mapped_column(Integer)
    publications_linked: Mapped[int | None] = mapped_column(Integer)
    embeddings_stored: Mapped[int | None] = mapped_column(Integer)
    summaries_generated: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str | None] = mapped_column(Text)
    error_message: Mapped[str | None] = mapped_column(Text)
