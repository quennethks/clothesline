import httpx


async def fetch_userinfo_email(token: str, userinfo_url: str) -> str | None:
    """Resolve a user's email from the OIDC userinfo endpoint.

    Zitadel issues JWT access tokens carrying only protocol claims (`sub`,
    `iss`, `aud`, `exp`, ...) — userinfo claims such as `email` appear in the
    ID token or here, never in the access token, and there is no Zitadel app
    setting to change that (`idTokenUserinfoAssertion` only affects the ID
    token). The API mirrors `email` (spec §5.5), so it's fetched here with the
    caller's own access token. Returns None if it can't be determined, which
    the caller turns into a 401 rather than inventing a user.
    """
    if not userinfo_url:
        return None
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(userinfo_url, headers={"Authorization": f"Bearer {token}"})
    except httpx.HTTPError:
        return None
    if resp.status_code != 200:
        return None
    email = resp.json().get("email")
    return email if isinstance(email, str) else None
