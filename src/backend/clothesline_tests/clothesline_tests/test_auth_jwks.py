import datetime

import pytest
from clothesline_api.auth import dependencies as deps_module
from clothesline_db.models import User
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from clothesline_tests.conftest import FakeJwks, sample_claims


def _claims_without_email(**overrides: object) -> dict[str, object]:
    """Mirrors a real Zitadel JWT access token, which carries no `email`
    claim — the shape that made every authenticated request 401 until the
    userinfo fallback landed."""
    claims = sample_claims(**overrides)
    claims.pop("email")
    return claims


async def test_valid_token_returns_current_user(client: AsyncClient, fake_jwks: FakeJwks) -> None:
    token = fake_jwks.make_token(sample_claims())
    resp = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["sub"] == "zitadel|user-1"
    assert body["email"] == "user@example.com"


async def test_expired_token_rejected(client: AsyncClient, fake_jwks: FakeJwks) -> None:
    now = datetime.datetime.now(datetime.UTC)
    expired_claims = sample_claims(
        iat=now - datetime.timedelta(hours=1), exp=now - datetime.timedelta(minutes=1)
    )
    token = fake_jwks.make_token(expired_claims)
    resp = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401


async def test_wrong_issuer_rejected(client: AsyncClient, fake_jwks: FakeJwks) -> None:
    token = fake_jwks.make_token(sample_claims(iss="https://not-the-right-issuer.example.com"))
    resp = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401


async def test_malformed_token_rejected(client: AsyncClient, fake_jwks: FakeJwks) -> None:
    resp = await client.get("/auth/me", headers={"Authorization": "Bearer not-a-real-jwt"})
    assert resp.status_code == 401


async def test_missing_token_rejected(client: AsyncClient) -> None:
    resp = await client.get("/auth/me")
    assert resp.status_code == 401


async def test_token_without_email_claim_resolves_email_from_userinfo(
    client: AsyncClient, fake_jwks: FakeJwks, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[str] = []

    async def _fake_userinfo(token: str, url: str) -> str:
        calls.append(token)
        return "from-userinfo@example.com"

    monkeypatch.setattr(deps_module, "fetch_userinfo_email", _fake_userinfo)
    token = fake_jwks.make_token(_claims_without_email())
    resp = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert resp.status_code == 200
    assert resp.json()["email"] == "from-userinfo@example.com"
    assert len(calls) == 1


async def test_token_without_email_claim_skips_userinfo_for_known_user(
    client: AsyncClient,
    fake_jwks: FakeJwks,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The hot sync path must not make a network call per request."""
    db_session.add(User(sub="zitadel|user-1", email="already-known@example.com"))
    await db_session.commit()

    async def _explode(token: str, url: str) -> str:
        raise AssertionError("userinfo should not be called for an already-mirrored user")

    monkeypatch.setattr(deps_module, "fetch_userinfo_email", _explode)
    token = fake_jwks.make_token(_claims_without_email())
    resp = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert resp.status_code == 200
    assert resp.json()["email"] == "already-known@example.com"


async def test_token_without_email_claim_rejected_when_userinfo_fails(
    client: AsyncClient, fake_jwks: FakeJwks, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _no_email(token: str, url: str) -> None:
        return None

    monkeypatch.setattr(deps_module, "fetch_userinfo_email", _no_email)
    token = fake_jwks.make_token(_claims_without_email())
    resp = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert resp.status_code == 401
