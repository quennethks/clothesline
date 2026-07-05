import uuid

from httpx import AsyncClient

from clothesline_tests.conftest import FakeJwks, sample_claims


async def test_auth_me_shape(client: AsyncClient, fake_jwks: FakeJwks) -> None:
    token = fake_jwks.make_token(sample_claims())
    resp = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert set(body.keys()) == {"id", "sub", "email"}
    assert uuid.UUID(body["id"])  # a real uuid, not the sub or email


async def test_auth_me_id_is_stable_across_calls(client: AsyncClient, fake_jwks: FakeJwks) -> None:
    token = fake_jwks.make_token(sample_claims())
    first = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    second = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert first.json()["id"] == second.json()["id"]
