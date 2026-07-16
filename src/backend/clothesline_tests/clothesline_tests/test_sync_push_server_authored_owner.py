import uuid

from clothesline_db.models import Load, User
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from clothesline_tests.conftest import load_doc, push_create, push_update

# `loads.user_id` is server-authored (registry: owner_field). The client's value
# is dropped on push and the server stamps the principal it resolved from the
# JWT, so a device holding a stale owner id can never author an unsyncable load.
#
# The regression these guard: `users.id` is a uuid4 minted per row, so any reset
# that recreates the users row hands the same Zitadel `sub` a brand-new owner id.
# Every load already stamped on a device then named a user that no longer
# existed and was refused forever — retrying can't change a value baked into a
# stored document. The refusal was reported as a null conflict, which the client
# discards, so the load was recorded as synced while the server never stored it,
# and every child deadlocked on 409 waiting for a parent that was never coming.


async def test_load_pushed_with_a_stale_owner_id_is_stored_and_owned_by_the_caller(
    authed_client: AsyncClient, test_user: User, db_session: AsyncSession
) -> None:
    """The exact shape of the reset: the device stamps an owner id that no
    longer exists. It must land anyway, owned by the authenticated user."""
    load_id = str(uuid.uuid4())
    stale_owner_id = uuid.uuid4()  # a users.id from before some reset
    assert stale_owner_id != test_user.id

    assert await push_create(authed_client, "loads", load_doc(load_id, stale_owner_id)) == []

    row = await db_session.get(Load, uuid.UUID(load_id))
    assert row is not None
    assert row.user_id == test_user.id  # the caller, not what the client sent


async def test_load_pushed_with_another_live_users_id_is_owned_by_the_caller(
    authed_client: AsyncClient, test_user: User, db_session: AsyncSession
) -> None:
    """The client's owner id isn't merely tolerated — it is ignored. Even a
    real other user's id can't be used to plant a load in their account."""
    other = User(sub="zitadel|somebody-else", email="somebody-else@example.com")
    db_session.add(other)
    await db_session.commit()

    load_id = str(uuid.uuid4())
    assert await push_create(authed_client, "loads", load_doc(load_id, other.id)) == []

    row = await db_session.get(Load, uuid.UUID(load_id))
    assert row is not None
    assert row.user_id == test_user.id

    # ...and it is genuinely not in the other user's account.
    theirs = await db_session.execute(select(Load).where(Load.user_id == other.id))
    assert theirs.scalars().all() == []


async def test_updating_a_load_cannot_reassign_its_owner(
    authed_client: AsyncClient, test_user: User, db_session: AsyncSession
) -> None:
    other = User(sub="zitadel|takeover-target", email="takeover@example.com")
    db_session.add(other)
    await db_session.commit()

    load_id = str(uuid.uuid4())
    await push_create(authed_client, "loads", load_doc(load_id, test_user.id))
    master = (await authed_client.get("/sync/loads")).json()["documents"][0]

    assert (
        await push_update(
            authed_client, "loads", {**master, "user_id": str(other.id), "name": "renamed"}, master
        )
        == []
    )

    row = await db_session.get(Load, uuid.UUID(load_id))
    assert row is not None
    assert row.name == "renamed"  # the legitimate part of the write applied
    assert row.user_id == test_user.id  # ownership did not move


async def test_stale_owner_id_in_assumed_master_state_is_not_a_conflict(
    authed_client: AsyncClient, test_user: User, db_session: AsyncSession
) -> None:
    """A device that created a load before a reset holds an assumed master
    state carrying the old owner id. That must not read as a conflict, or the
    first edit after reconnecting would be silently reverted (master wins)."""
    load_id = str(uuid.uuid4())
    await push_create(authed_client, "loads", load_doc(load_id, test_user.id))
    master = (await authed_client.get("/sync/loads")).json()["documents"][0]

    stale_master = {**master, "user_id": str(uuid.uuid4())}
    resp = await push_update(
        authed_client, "loads", {**stale_master, "shop_name": "Wash & Fold"}, stale_master
    )

    assert resp == []  # no conflict: owner is excluded from the comparison
    row = await db_session.get(Load, uuid.UUID(load_id))
    assert row is not None
    assert row.shop_name == "Wash & Fold"  # the write was applied, not reverted


async def test_owner_is_still_returned_on_pull(
    authed_client: AsyncClient, test_user: User
) -> None:
    """Server-authored means unwritable, not invisible: the client still needs
    the owner on pull, which is what keeps its schema unchanged."""
    load_id = str(uuid.uuid4())
    await push_create(authed_client, "loads", load_doc(load_id, uuid.uuid4()))

    doc = (await authed_client.get("/sync/loads")).json()["documents"][0]
    assert doc["user_id"] == str(test_user.id)


async def test_children_land_once_their_parent_load_exists(
    authed_client: AsyncClient, test_user: User
) -> None:
    """The end of the deadlock: a load stamped with a stale owner now lands, so
    its category no longer 409s forever waiting on a parent that never arrives."""
    load_id = str(uuid.uuid4())
    await push_create(authed_client, "loads", load_doc(load_id, uuid.uuid4()))

    category = {
        "id": str(uuid.uuid4()),
        "load_id": load_id,
        "category": "Shirts",
        "count_sent": 0,
        "count_received": None,
        "count_mode": "auto",
        "created_at": "2026-01-01T00:00:00.000Z",
        "updated_at": "2026-01-01T00:00:00.000Z",
        "_deleted": False,
    }
    resp = await authed_client.post(
        "/sync/load_item_categories",
        json=[{"new_document_state": category, "assumed_master_state": None}],
    )
    assert resp.status_code == 200  # not 409
    assert resp.json() == []
