from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


def redis_ssl_kwargs(redis_url: str) -> dict:
    """Extra kwargs needed for rediss:// URLs (Upstash and other managed providers).

    redis-py and Celery both raise ValueError on a bare rediss:// URL unless
    ssl_cert_reqs is set explicitly -- they will not default it.

    Use "required" (full cert + hostname verification), not "none": Upstash's
    cert is signed by a public CA and its TLS-terminating proxy expects a
    normal handshake with SNI. Kombu's redis transport (used by Celery) drops
    the connection with "UNEXPECTED_EOF_WHILE_READING" when cert_reqs=NONE
    against this kind of proxy, whereas plain redis-py is more lenient --
    keep both paths on the same, working setting.
    """
    if redis_url.startswith("rediss://"):
        return {"ssl_cert_reqs": "required"}
    return {}


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
_KNOWN_PUBLIC_SECRET_KEYS = {
    DEFAULT_SECRET_KEY,
    "change-me-to-a-random-64-char-string-before-any-real-deployment",
}
MIN_PRODUCTION_SECRET_KEY_LENGTH = 32
_DEV_DATABASE_URLS = {
    "postgresql+asyncpg://atlas:atlas_dev_password@localhost:5432/atlas",
}


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
    if settings.secret_key in _KNOWN_PUBLIC_SECRET_KEYS:
        problems.append(
            "SECRET_KEY is still a public default from source control -- anyone can forge a JWT for "
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

    if settings.database_url in _DEV_DATABASE_URLS:
        problems.append(
            "DATABASE_URL is the local development default -- set it to your production database connection string."
        )

    llm_keys_set = any([settings.gemini_api_key, settings.groq_api_key, settings.mistral_api_key])
    if not llm_keys_set:
        problems.append(
            "No LLM API key is configured (GEMINI_API_KEY, GROQ_API_KEY, MISTRAL_API_KEY are all empty). "
            "The analysis pipeline will fall back to Ollama, which is not available in a cloud deployment. "
            "Set at least one provider key."
        )

    if problems:
        raise InsecureProductionConfig(
            "Refusing to start with an insecure production configuration:\n- " + "\n- ".join(problems)
        )


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    validate_production_settings(settings)
    return settings
