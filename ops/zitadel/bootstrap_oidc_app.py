"""Creates the `clothesline-web` OIDC application in Zitadel via the
Management API, since Zitadel's declarative FirstInstance bootstrap
(init-steps.yaml) has no Projects/OIDCApps section — client registration is
only possible through the API, not the init-steps file (verified against
cmd/setup/steps.yaml in the zitadel/zitadel repo).

Idempotent: safe to run on every `aspire run` — looks up the project/app by
name before creating either, so restarts don't create duplicates. Writes the
resulting client_id to CLIENT_ID_OUTPUT_PATH for the apphost to read back into
the web app's environment.
"""

import os
import time

import httpx

API_URL = os.environ["ZITADEL_API_URL"].rstrip("/")
PAT_PATH = os.environ.get("ADMIN_PAT_PATH", "/machinekey/admin.pat")
OUTPUT_PATH = os.environ.get("CLIENT_ID_OUTPUT_PATH", "/output/client_id.txt")
REDIRECT_URI = os.environ["REDIRECT_URI"]
POST_LOGOUT_REDIRECT_URI = os.environ["POST_LOGOUT_REDIRECT_URI"]
# Zitadel resolves the instance by the request's Host header (matching
# ExternalDomain/ExternalPort), not by the connection address — the
# container-network hostname in ZITADEL_API_URL doesn't match `ExternalDomain
# = localhost`, so every call 404s ("instance not found") unless this header
# is forced to the browser-facing host (verified empirically: same request
# went from 404 to 401-then-200 once this header was added).
ZITADEL_EXTERNAL_HOST = os.environ["ZITADEL_EXTERNAL_HOST"]

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
        # dev_mode relaxes some OIDC compliance checks (e.g. allows a
        # non-HTTPS localhost redirect URI) — fine for local dev, must be
        # revisited for the production Zitadel app registration (M8).
        "devMode": True,
        "accessTokenType": "OIDC_TOKEN_TYPE_JWT",
    }
    resp = client.post(f"/management/v1/projects/{project_id}/apps/oidc", json=body)
    resp.raise_for_status()
    return str(resp.json()["clientId"])


def main() -> None:
    pat = wait_for_pat(PAT_PATH)
    with httpx.Client(
        base_url=API_URL,
        headers={"Authorization": f"Bearer {pat}", "Host": ZITADEL_EXTERNAL_HOST},
        timeout=30.0,
    ) as client:
        project_id = find_project_id(client) or create_project(client)
        client_id = find_app_client_id(client, project_id)
        if client_id is None:
            client_id = create_app(client, project_id)

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        f.write(client_id)
    print(f"OIDC client_id: {client_id}")


if __name__ == "__main__":
    main()
