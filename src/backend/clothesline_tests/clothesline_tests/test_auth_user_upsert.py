from clothesline_db.models import User
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from clothesline_tests.conftest import FakeJwks, sample_claims


async def test_first_request_creates_user(
    client: AsyncClient, fake_jwks: FakeJwks, db_session: AsyncSession
) -> None:
    token = fake_jwks.make_token(sample_claims(sub="zitadel|new-user", email="new@example.com"))
    resp = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200

    user = (
        await db_session.execute(select(User).where(User.sub == "zitadel|new-user"))
    ).scalar_one()
    assert user.email == "new@example.com"


async def test_changed_email_updates_in_place_not_duplicated(
    client: AsyncClient, fake_jwks: FakeJwks, db_session: AsyncSession
) -> None:
    first_token = fake_jwks.make_token(sample_claims(sub="zitadel|drift", email="old@example.com"))
    await client.get("/auth/me", headers={"Authorization": f"Bearer {first_token}"})

    second_token = fake_jwks.make_token(sample_claims(sub="zitadel|drift", email="new@example.com"))
    resp = await client.get("/auth/me", headers={"Authorization": f"Bearer {second_token}"})
    assert resp.status_code == 200
    assert resp.json()["email"] == "new@example.com"

    count = (
        await db_session.execute(
            select(func.count()).select_from(User).where(User.sub == "zitadel|drift")
        )
    ).scalar_one()
    assert count == 1

    user = (
        await db_session.execute(select(User).where(User.sub == "zitadel|drift"))
    ).scalar_one()
    assert user.email == "new@example.com"
