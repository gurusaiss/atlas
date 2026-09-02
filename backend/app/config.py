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

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() in ("production", "prod")


DEFAULT_SECRET_KEY = "insecure-dev-key-change-me"
MIN_PRODUCTION_SECRET_KEY_LENGTH = 32


class InsecureProductionConfig(RuntimeError):
    """Raised at startup to refuse booting with a config that would compromise
    every user's auth if deployed as-is. This is deliberately fatal, not a log
    warning: this repo is public, so the default SECRET_KEY is not a secret --
    anyone who reads the source can forge a valid JWT for any user if a real
    deployment ever ran with it. A crash on boot is a far smaller cost than a
    silent full auth bypass in production.
    """


def validate_production_settings(settings: "Settings") -> None:
    if not settings.is_production:
        return

    problems = []
    if settings.secret_key == DEFAULT_SECRET_KEY:
        problems.append(
            "SECRET_KEY is still the public default from source control -- anyone can forge a JWT for "
            "any user. Set a real random value (e.g. `python -c \"import secrets; "
            'print(secrets.token_urlsafe(64))"`).'
        )
    elif len(settings.secret_key) < MIN_PRODUCTION_SECRET_KEY_LENGTH:
        problems.append(
            f"SECRET_KEY is only {len(settings.secret_key)} characters -- use at least "
            f"{MIN_PRODUCTION_SECRET_KEY_LENGTH} random characters in production."
        )

    if not settings.cors_origins_list:
        problems.append("CORS_ORIGINS is empty in production -- the frontend would not be able to call this API.")
    if "*" in settings.cors_origins_list:
        problems.append("CORS_ORIGINS contains '*' in production -- this allows any website to call this API "
                         "with credentials, defeating the purpose of authentication cookies.")

    if problems:
        raise InsecureProductionConfig(
            "Refusing to start with an insecure production configuration:\n- " + "\n- ".join(problems)
        )


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    validate_production_settings(settings)
    return settings
