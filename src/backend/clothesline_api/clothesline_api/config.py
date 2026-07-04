import os

from pydantic_settings import BaseSettings, SettingsConfigDict


def _adonet_to_asyncpg_url(conn_str: str) -> str:
    """Convert an Aspire/.NET-style `Key=Value;Key=Value` Postgres connection
    string into a `postgresql+asyncpg://` URL. Aspire's Postgres integration
    injects connection strings in this ADO.NET form (e.g.
    `Host=...;Port=...;Username=...;Password=...;Database=...`), not a URI."""
    parts = dict(
        item.split("=", 1) for item in conn_str.split(";") if item.strip() and "=" in item
    )
    lower = {k.strip().lower(): v.strip() for k, v in parts.items()}
    host = lower.get("host", "localhost")
    port = lower.get("port", "5432")
    user = lower.get("username", lower.get("user id", "postgres"))
    password = lower.get("password", "postgres")
    database = lower.get("database", "clothesline_db")
    return f"postgresql+asyncpg://{user}:{password}@{host}:{port}/{database}"


def _resolve_database_url() -> str:
    # Aspire injects `ConnectionStrings__<resourcename>` for referenced resources.
    raw = os.environ.get("ConnectionStrings__clothesline_db")
    if raw:
        return _adonet_to_asyncpg_url(raw)
    return "postgresql+asyncpg://postgres:postgres@localhost:5432/clothesline_db"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore")

    database_url: str = _resolve_database_url()
    allowed_origins: str = os.environ.get("ALLOWED_ORIGINS", "*")
    oidc_issuer: str = os.environ.get("OIDC_ISSUER", "")
    oidc_jwks_url: str = os.environ.get("OIDC_JWKS_URL", "")

    @property
    def allowed_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]


settings = Settings()
