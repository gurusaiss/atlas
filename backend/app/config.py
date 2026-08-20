from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"
    debug: bool = True
    secret_key: str = "insecure-dev-key-change-me"
    cors_origins: str = "http://localhost:5173"

    database_url: str = "postgresql+asyncpg://atlas:atlas_dev_password@localhost:5432/atlas"
    redis_url: str = "redis://localhost:6379/0"

    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    gemini_api_key: str = ""
    groq_api_key: str = ""
    mistral_api_key: str = ""
    ollama_base_url: str = "http://localhost:11434"

    default_token_budget: int = 50_000

    chroma_persist_dir: str = "./chroma_data"

    max_upload_size_mb: int = 50
    upload_tmp_dir: str = "./tmp_uploads"

    otel_exporter_otlp_endpoint: str = ""
    prometheus_metrics_enabled: bool = True

    @property
    def cors_origins_list(self) -> list[str]:
        # Strips a trailing slash on each configured origin -- browsers send the
        # Origin header WITHOUT a trailing slash, so "https://x.app/" in the env
        # var would otherwise silently fail every single CORS check.
        return [
            origin.strip().rstrip("/") for origin in self.cors_origins.split(",") if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()
