from httpx import AsyncClient

from clothesline_tests.conftest import FakeJwks, sample_claims

# Most sync tests bypass real JWT mechanics via authed_client for speed —
# this is the one test exercising the real get_current_user dependency
# end-to-end on the /sync surface (M5's fake-JWKS fixture already covers
# the validation logic itself in depth).


async def test_missing_token_rejected(client: AsyncClient) -> None:
    resp = await client.get("/sync/loads")
    assert resp.status_code == 401


async def test_valid_token_allows_pull(client: AsyncClient, fake_jwks: FakeJwks) -> None:
    token = fake_jwks.make_token(sample_claims())
    resp = await client.get("/sync/loads", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
