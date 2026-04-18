from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ROOT_DIR / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    database_url: str = "postgresql+asyncpg://candle:candle@localhost:5432/candle"
    openai_api_key: str = ""
    embedding_model: str = "text-embedding-3-small"
    chat_model: str = "gpt-4o-mini"
    frontend_origin: str = "http://localhost:5173"
    clinical_trials_base_url: str = "https://clinicaltrials.gov/api/v2/studies"
    pubmed_search_url: str = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
    pubmed_fetch_url: str = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
    ncbi_user_agent: str = Field(
        default="Candle/1.0 (+https://localhost; local research app)"
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
