"""GET /config — the browser app's runtime configuration.

The frontend cannot have the OIDC client_id compiled into it: Vite bakes
import.meta.env in at build time, but Zitadel only generates the client_id once
it has been deployed and bootstrapped. So the API serves it instead.
"""

from httpx import AsyncClient


async def test_config_is_public(client: AsyncClient) -> None:
    # Must work WITHOUT a token — the client needs the issuer and client_id in
    # order to sign in at all, so requiring auth here would be circular.
    resp = await client.get("/config")
    assert resp.status_code == 200


async def test_config_exposes_the_oidc_settings_the_client_needs(client: AsyncClient) -> None:
    body = (await client.get("/config")).json()
    assert set(body) == {"oidc_issuer", "oidc_client_id", "api_base_url"}
