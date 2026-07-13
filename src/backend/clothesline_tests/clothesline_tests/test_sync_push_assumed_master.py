import uuid

from clothesline_db.models import Load, LoadItemCategory, User
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from clothesline_tests.conftest import PLACEHOLDER_TS, load_doc, push_create, push_update

# RxDB does not re-pull between writes: after a successful push it records the
# document *it pushed* as the assumed master state (replication-protocol/
# upstream.js -> getMetaWriteRow(state, docData)). Since `updated_at` is
# server-authored, that assumed master always carries the client's timestamp,
# never the server's. If the server compared the two docs whole, the second
# write to any document would look like a conflict, and RxDB's default conflict
# handler (resolve -> realMasterState) would revert the local change. These
# tests pin the comparison to replicated *content* only.

SECOND_TS = "2026-01-01T00:00:01.000Z"


async def test_second_write_with_client_authored_timestamp_is_not_a_conflict(
    authed_client: AsyncClient, test_user: User, db_session: AsyncSession
) -> None:
    load_id = str(uuid.uuid4())
    created = load_doc(load_id, test_user.id)
    assert await push_create(authed_client, "loads", created) == []

    # Exactly what RxDB sends next: assumed master == the doc just pushed,
    # still carrying the client's PLACEHOLDER_TS rather than the server's now().
    resp = await push_update(
        authed_client,
        "loads",
        {**created, "name": "renamed", "updated_at": SECOND_TS},
        created,
    )
    assert resp == []

    db_session.expire_all()
    row = await db_session.get(Load, uuid.UUID(load_id))
    assert row is not None
    assert row.name == "renamed"


async def test_content_conflict_still_detected_despite_ignored_timestamps(
    authed_client: AsyncClient, test_user: User
) -> None:
    """The timestamp exemption must not swallow a genuine stale-write conflict:
    same client timestamps on both pushes, but B assumed a name A had replaced."""
    load_id = str(uuid.uuid4())
    created = load_doc(load_id, test_user.id)
    await push_create(authed_client, "loads", created)

    assert (
        await push_update(
            authed_client, "loads", {**created, "name": "From A", "updated_at": SECOND_TS}, created
        )
        == []
    )

    resp_b = await push_update(
        authed_client,
        "loads",
        {**created, "name": "From B", "updated_at": SECOND_TS},
        created,  # stale: still assumes the pre-A name
    )
    assert len(resp_b) == 1
    assert resp_b[0]["name"] == "From A"


async def test_tap_counter_increment_is_applied_not_reverted(
    authed_client: AsyncClient, test_user: User, db_session: AsyncSession
) -> None:
    """The reported bug, end to end on the collection the +/- buttons write to:
    a category is created at count_sent=0, then incremented to 1."""
    load_id = str(uuid.uuid4())
    await push_create(authed_client, "loads", load_doc(load_id, test_user.id))

    category_id = str(uuid.uuid4())
    category = {
        "id": category_id,
        "load_id": load_id,
        "category": "shirts",
        "count_sent": 0,
        "count_received": None,
        "count_mode": "auto",
        "created_at": PLACEHOLDER_TS,
        "updated_at": PLACEHOLDER_TS,
        "_deleted": False,
    }
    assert await push_create(authed_client, "load_item_categories", category) == []

    incremented = {**category, "count_sent": 1, "count_mode": "manual", "updated_at": SECOND_TS}
    assert await push_update(authed_client, "load_item_categories", incremented, category) == []

    db_session.expire_all()
    row = await db_session.get(LoadItemCategory, uuid.UUID(category_id))
    assert row is not None
    assert row.count_sent == 1  # not reverted to 0


async def test_pushed_document_round_trips_through_pull_unchanged_except_timestamps(
    authed_client: AsyncClient, test_user: User
) -> None:
    """The replication protocol needs pull to hand back what push accepted —
    otherwise every pull looks like a divergence to the client."""
    load_id = str(uuid.uuid4())
    created = load_doc(load_id, test_user.id, name="round-trip", total_sent=3)
    await push_create(authed_client, "loads", created)

    pulled = (await authed_client.get("/sync/loads")).json()["documents"][0]

    ignored = {"created_at", "updated_at"}
    assert {k: v for k, v in pulled.items() if k not in ignored} == {
        k: v for k, v in created.items() if k not in ignored
    }
    assert pulled["updated_at"] != PLACEHOLDER_TS  # server authored it
