import jwt
from jwt import PyJWKClient

_jwks_clients: dict[str, PyJWKClient] = {}


def get_jwks_client(jwks_url: str) -> PyJWKClient:
    # PyJWKClient caches fetched keys by kid internally; one client per URL is
    # enough (this module is a process-wide singleton registry keyed by URL
    # so tests can point at a different stub URL than the real deployment).
    client = _jwks_clients.get(jwks_url)
    if client is None:
        client = PyJWKClient(jwks_url)
        _jwks_clients[jwks_url] = client
    return client


def decode_access_token(token: str, *, issuer: str, jwks_url: str) -> dict[str, object]:
    """Verify signature (via JWKS), issuer, and expiry. `aud` is deliberately
    not validated (spec §5.5 MVP simplification — single-purpose self-hosted
    Zitadel instance; revisit if the threat model changes)."""
    signing_key = get_jwks_client(jwks_url).get_signing_key_from_jwt(token)
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        issuer=issuer,
        options={"verify_aud": False},
    )
