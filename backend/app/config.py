from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT_DIR = Path(__file__).resolve().parents[2]
DEFAULT_DATABASE_URL = "postgresql+asyncpg://candle:candle@localhost:5432/candle"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ROOT_DIR / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    deployment_env: str = "development"
    database_url: str = DEFAULT_DATABASE_URL

    @property
    def async_database_url(self) -> str:
        url = self.database_url
        if url.startswith("postgresql://") or url.startswith("postgres://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        return url
    openai_api_key: str = ""
    embedding_model: str = "text-embedding-3-small"
    chat_model: str = "gpt-4o-mini"
    frontend_origin: str = "http://localhost:5173"
    trust_proxy_headers: bool = False
    ask_rate_limit_per_minute: int = 6
    ask_rate_limit_burst: int = 2
    publication_overview_rate_limit_per_minute: int = 20
    publication_overview_rate_limit_burst: int = 5
    llm_concurrency_limit: int = 8
    llm_request_body_max_bytes: int = 8 * 1024
    ask_question_max_chars: int = 2000
    ask_openai_timeout_seconds: int = 15
    publication_overview_timeout_seconds: int = 12
    embedding_timeout_seconds: int = 20
    trial_summary_timeout_seconds: int = 20
    background_openai_max_retries: int = 2
    background_openai_retry_backoff_seconds: float = 0.5
    clinical_trials_base_url: str = "https://clinicaltrials.gov/api/v2/studies"
    pubmed_search_url: str = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
    pubmed_fetch_url: str = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
    ncbi_user_agent: str = Field(
        default="Candle/1.0 (+https://localhost; local research app)"
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
