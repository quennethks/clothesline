import uuid

from clothesline_db.models import Load, User
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from clothesline_tests.conftest import load_doc, push_create


async def test_identical_push_twice_yields_exactly_one_row(
    authed_client: AsyncClient, test_user: User, db_session: AsyncSession
) -> None:
    load_id = str(uuid.uuid4())
    doc = load_doc(load_id, test_user.id)

    first = await push_create(authed_client, "loads", doc)
    assert first == []

    # Same create pushed again (e.g. client retried after a dropped
    # response) — the row already exists so it comes back as a conflict,
    # but its content already matches what the client intended.
    second = await push_create(authed_client, "loads", doc)
    assert len(second) == 1
    assert second[0]["id"] == load_id

    count = (
        await db_session.execute(
            select(func.count()).select_from(Load).where(Load.id == uuid.UUID(load_id))
        )
    ).scalar_one()
    assert count == 1
