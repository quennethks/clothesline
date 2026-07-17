"""Blob Storage access for photo bytes (spec §8).

Bytes never pass through this API — it only mints short-lived, permission-scoped
SAS URLs that the client uses to talk to Blob Storage directly (spec §8.2/§8.4).
The container is private; the storage account key is never handed to a client.
"""

import datetime
from urllib.parse import urlsplit, urlunsplit

from azure.identity import DefaultAzureCredential
from azure.storage.blob import (
    BlobSasPermissions,
    BlobServiceClient,
    generate_blob_sas,
)

from clothesline_api.config import settings

SAS_TTL = datetime.timedelta(minutes=15)


def _blob_service_client() -> BlobServiceClient:
    connection = settings.blob_connection_string
    # Pinned rather than left to the SDK default: the SDK ships a newer REST
    # API version than Azurite implements, and Azurite hard-rejects any
    # request it doesn't recognise ("The API version ... is not supported by
    # Azurite"), so every local media call 500s. Real Azure accepts this
    # version too, so both paths use the same one.
    api_version = settings.blob_api_version

    # Azurite (and any key-based account) hands us a full connection string;
    # in Azure the Aspire/azd wiring injects a bare service URI instead and
    # authentication comes from the container app's managed identity.
    if "AccountKey=" in connection:
        return BlobServiceClient.from_connection_string(connection, api_version=api_version)
    return BlobServiceClient(
        account_url=connection,
        credential=DefaultAzureCredential(),
        api_version=api_version,
    )


def _account_key(client: BlobServiceClient) -> str | None:
    credential = client.credential
    return getattr(credential, "account_key", None)


def blob_key_for(user_id: object, photo_id: object) -> str:
    """Blob keys are user-prefixed, so a SAS minted for one user can never
    address another user's bytes even if the photo id were guessed."""
    return f"{user_id}/{photo_id}"


def _public_url(url: str) -> str:
    """Rewrite a SAS URL's origin to the browser-reachable one when they
    differ. The API reaches Azurite over the container network (or
    127.0.0.1), but the *browser* — which is what actually PUTs/GETs the
    bytes — may need a different host entirely (a forwarded Codespaces
    subdomain). Same split already applied to Zitadel's issuer vs. JWKS URL.
    """
    origin = settings.blob_public_origin
    if not origin:
        return url
    parts = urlsplit(url)
    public = urlsplit(origin)
    return urlunsplit((public.scheme, public.netloc, parts.path, parts.query, parts.fragment))


def _sas_token(client: BlobServiceClient, blob_key: str, permission: BlobSasPermissions) -> str:
    now = datetime.datetime.now(datetime.UTC)
    # Backdate the start slightly — a SAS is rejected outright if the storage
    # service's clock is a few seconds behind the API's.
    start = now - datetime.timedelta(minutes=5)
    expiry = now + SAS_TTL

    account_name = client.account_name
    if account_name is None:
        raise RuntimeError("blob storage is not configured (no account name)")

    account_key = _account_key(client)
    delegation_key = (
        None
        if account_key
        else client.get_user_delegation_key(key_start_time=start, key_expiry_time=expiry)
    )
    return generate_blob_sas(
        account_name=account_name,
        container_name=settings.blob_container,
        blob_name=blob_key,
        account_key=account_key,
        user_delegation_key=delegation_key,
        permission=permission,
        start=start,
        expiry=expiry,
    )


def _sas_url(blob_key: str, permission: BlobSasPermissions) -> tuple[str, datetime.datetime]:
    client = _blob_service_client()
    token = _sas_token(client, blob_key, permission)
    blob_client = client.get_blob_client(container=settings.blob_container, blob=blob_key)
    expires_at = datetime.datetime.now(datetime.UTC) + SAS_TTL
    return f"{_public_url(blob_client.url)}?{token}", expires_at


def upload_sas_url(blob_key: str) -> tuple[str, datetime.datetime]:
    return _sas_url(blob_key, BlobSasPermissions(create=True, write=True))


def read_sas_url(blob_key: str) -> tuple[str, datetime.datetime]:
    return _sas_url(blob_key, BlobSasPermissions(read=True))


def ensure_container() -> None:
    """Create the private photo container if it doesn't exist yet.

    CORS is deliberately *not* set here. The browser PUTs/GETs bytes directly to
    Blob, so the account must allow the web origin cross-origin — but "Set Blob
    Service Properties" (which configures CORS) is authorized only by account key
    or account SAS, never by Microsoft Entra, and the deployed account disables
    shared-key access. So CORS is provisioned in the Aspire AppHost (bicep)
    instead; see the storage.ConfigureInfrastructure block there.
    """
    client = _blob_service_client()
    container = client.get_container_client(settings.blob_container)
    if not container.exists():
        container.create_container()  # private by default — no public access
