import os

from clothesline_db.url import adonet_to_asyncpg_url
from pydantic_settings import BaseSettings, SettingsConfigDict


def _resolve_database_url() -> str:
    # Aspire injects `ConnectionStrings__<resourcename>` for referenced resources.
    raw = os.environ.get("ConnectionStrings__clothesline_db")
    if raw:
        return adonet_to_asyncpg_url(raw)
    return "postgresql+asyncpg://postgres:postgres@localhost:5432/clothesline_db"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore")

    database_url: str = _resolve_database_url()
    allowed_origins: str = os.environ.get("ALLOWED_ORIGINS", "*")
    oidc_issuer: str = os.environ.get("OIDC_ISSUER", "")
    oidc_jwks_url: str = os.environ.get("OIDC_JWKS_URL", "")
    oidc_userinfo_url: str = os.environ.get("OIDC_USERINFO_URL", "")

    @property
    def allowed_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]


settings = Settings()
