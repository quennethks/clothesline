import datetime

from httpx import AsyncClient

from clothesline_tests.conftest import FakeJwks, sample_claims


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
