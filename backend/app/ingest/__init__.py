"""Ingest pipeline: ClinicalTrials.gov, PubMed, linking, overviews, embeddings and trial summaries. Run with `make ingest` (`python -m app.ingest.run`)."""

from app.ingest.summarise import generate_trial_summaries


__all__ = ["clinicaltrials", "embed", "generate_trial_summaries", "link", "pubmed", "run"]
