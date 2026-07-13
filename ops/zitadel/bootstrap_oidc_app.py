"""Creates the `clothesline-web` OIDC application in Zitadel via the
Management API, since Zitadel's declarative FirstInstance bootstrap
(init-steps.yaml) has no Projects/OIDCApps section — client registration is
only possible through the API, not the init-steps file (verified against
cmd/setup/steps.yaml in the zitadel/zitadel repo).

Idempotent: safe to run on every `aspire run` and on every release — looks up
the project/app by name before creating either, so repeats don't create
duplicates.

The generated client_id has to reach the API (which serves it to the browser
over GET /config). How it gets there depends on where this runs:

  local   — written to CLIENT_ID_OUTPUT_PATH, a file the AppHost reads back.
  Azure   — written to Key Vault (KEYVAULT_URI + CLIENT_ID_SECRET_NAME), which
            the API references as a secret. There is no shared host filesystem
            between an ACA Job and a container app, so the file trick can't work.
"""

import os
import time

import httpx

API_URL = os.environ["ZITADEL_API_URL"].rstrip("/")
PAT_PATH = os.environ.get("ADMIN_PAT_PATH", "/machinekey/admin.pat")
OUTPUT_PATH = os.environ.get("CLIENT_ID_OUTPUT_PATH")
KEYVAULT_URI = os.environ.get("KEYVAULT_URI")
CLIENT_ID_SECRET_NAME = os.environ.get("CLIENT_ID_SECRET_NAME", "oidc-client-id")
REDIRECT_URI = os.environ["REDIRECT_URI"]
POST_LOGOUT_REDIRECT_URI = os.environ["POST_LOGOUT_REDIRECT_URI"]
# dev_mode relaxes OIDC compliance checks (e.g. allows a non-HTTPS localhost
# redirect URI). Correct locally, a real weakening of the registration in
# production — so it follows the mode rather than being hard-coded on.
DEV_MODE = os.environ.get("OIDC_DEV_MODE", "true").lower() == "true"
# Zitadel resolves the instance by the request's Host header (matching
# ExternalDomain/ExternalPort), not by the connection address — the
# container-network hostname in ZITADEL_API_URL doesn't match `ExternalDomain
# = localhost`, so every call 404s ("instance not found") unless this header
# is forced to the browser-facing host (verified empirically: same request
# went from 404 to 401-then-200 once this header was added).
ZITADEL_EXTERNAL_HOST = os.environ["ZITADEL_EXTERNAL_HOST"]
# ...but in Azure, Host is not ours to set: Container Apps' ingress routes on it,
# so overriding it means the request never reaches Zitadel (ACA answers 404 first),
# while leaving it alone means Zitadel answers 404 ("instance not found"). Zitadel
# is therefore configured there to read the instance host from this header instead,
# leaving Host to ACA. Unset locally, where Host works and no ingress intercepts it.
ZITADEL_HOST_HEADER = os.environ.get("ZITADEL_HOST_HEADER")

PROJECT_NAME = "clothesline"
APP_NAME = "clothesline-web"


def wait_for_pat(path: str, timeout: float = 60.0) -> str:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if os.path.exists(path):
            content = open(path).read().strip()
            if content:
                return content
        time.sleep(1)
    raise TimeoutError(f"Timed out waiting for admin PAT at {path}")


def find_project_id(client: httpx.Client) -> str | None:
    resp = client.post("/management/v1/projects/_search", json={})
    resp.raise_for_status()
    for project in resp.json().get("result", []):
        if project.get("name") == PROJECT_NAME:
            return str(project["id"])
    return None


def create_project(client: httpx.Client) -> str:
    resp = client.post("/management/v1/projects", json={"name": PROJECT_NAME})
    resp.raise_for_status()
    return str(resp.json()["id"])


def find_app_client_id(client: httpx.Client, project_id: str) -> str | None:
    resp = client.post(f"/management/v1/projects/{project_id}/apps/_search", json={})
    resp.raise_for_status()
    for app in resp.json().get("result", []):
        if app.get("name") == APP_NAME:
            oidc_config = app.get("oidcConfig")
            if oidc_config and oidc_config.get("clientId"):
                return str(oidc_config["clientId"])
    return None


def create_app(client: httpx.Client, project_id: str) -> str:
    body = {
        "name": APP_NAME,
        "redirectUris": [REDIRECT_URI],
        "responseTypes": ["OIDC_RESPONSE_TYPE_CODE"],
        "grantTypes": ["OIDC_GRANT_TYPE_AUTHORIZATION_CODE", "OIDC_GRANT_TYPE_REFRESH_TOKEN"],
        "appType": "OIDC_APP_TYPE_USER_AGENT",
        "authMethodType": "OIDC_AUTH_METHOD_TYPE_NONE",
        "postLogoutRedirectUris": [POST_LOGOUT_REDIRECT_URI],
        "devMode": DEV_MODE,
        "accessTokenType": "OIDC_TOKEN_TYPE_JWT",
    }
    resp = client.post(f"/management/v1/projects/{project_id}/apps/oidc", json=body)
    resp.raise_for_status()
    return str(resp.json()["clientId"])


def publish_client_id(client_id: str) -> None:
    """Hand the client_id to whoever needs to read it back."""
    if KEYVAULT_URI:
        # Managed identity — the job's own, granted secret-set rights on the
        # vault by the AppHost's role assignment.
        from azure.identity import DefaultAzureCredential
        from azure.keyvault.secrets import SecretClient

        secrets = SecretClient(vault_url=KEYVAULT_URI, credential=DefaultAzureCredential())
        secrets.set_secret(CLIENT_ID_SECRET_NAME, client_id)
        print(f"OIDC client_id written to Key Vault as '{CLIENT_ID_SECRET_NAME}'")
        return

    if OUTPUT_PATH:
        os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
        with open(OUTPUT_PATH, "w") as f:
            f.write(client_id)
        print(f"OIDC client_id written to {OUTPUT_PATH}")
        return

    raise RuntimeError("Neither KEYVAULT_URI nor CLIENT_ID_OUTPUT_PATH is set — nowhere to report the client_id")


def main() -> None:
    pat = wait_for_pat(PAT_PATH)
    headers = {"Authorization": f"Bearer {pat}"}
    if ZITADEL_HOST_HEADER:
        headers[ZITADEL_HOST_HEADER] = ZITADEL_EXTERNAL_HOST
    else:
        headers["Host"] = ZITADEL_EXTERNAL_HOST
    with httpx.Client(
        base_url=API_URL,
        headers=headers,
        timeout=30.0,
    ) as client:
        project_id = find_project_id(client) or create_project(client)
        client_id = find_app_client_id(client, project_id)
        if client_id is None:
            client_id = create_app(client, project_id)

    publish_client_id(client_id)
    print(f"OIDC client_id: {client_id}")


if __name__ == "__main__":
    main()
