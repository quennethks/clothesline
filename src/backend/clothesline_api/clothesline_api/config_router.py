from fastapi import APIRouter

from clothesline_api.config import settings

router = APIRouter(tags=["config"])


@router.get("/config")
async def config() -> dict[str, str]:
    """Runtime configuration for the browser app.

    Unauthenticated by necessity — the client needs the issuer and client_id in
    order to sign in at all. Neither is a secret: a public OIDC client's id is
    published in every authorization request by design.

    This exists because Vite substitutes `import.meta.env` into the bundle at
    *build* time, while Zitadel only generates the client_id once it has been
    deployed and bootstrapped. Serving these from the API breaks that
    chicken-and-egg, and lets the same web image run in any environment.
    """
    return {
        "oidc_issuer": settings.oidc_issuer,
        "oidc_client_id": settings.oidc_client_id,
        "api_base_url": settings.api_base_url,
    }
