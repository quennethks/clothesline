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

    # Azurite locally (a full connection string), a bare service URI + managed
    # identity in Azure — media/blob.py branches on which one it got.
    blob_connection_string: str = os.environ.get("ConnectionStrings__blobs", "")
    blob_container: str = os.environ.get("BLOB_CONTAINER", "photos")
    # See media/blob.py — the SDK's default is ahead of what Azurite accepts.
    blob_api_version: str = os.environ.get("BLOB_API_VERSION", "2025-01-05")
    # The origin the *browser* reaches Blob on, when that differs from the
    # one the API reaches it on (Codespaces port forwarding). Empty in Azure,
    # where both are the same public account endpoint.
    blob_public_origin: str = os.environ.get("BLOB_PUBLIC_ORIGIN", "")

    @property
    def allowed_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]


settings = Settings()
