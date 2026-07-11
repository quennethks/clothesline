import uuid

from clothesline_db.models import Load, LoadStatus, User
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from clothesline_tests.conftest import PLACEHOLDER_TS, load_doc, push_create, push_update


def _category_doc(category_id: str, load_id: str, **overrides: object) -> dict[str, object]:
    doc: dict[str, object] = {
        "id": category_id,
        "load_id": load_id,
        "category": "Shirts",
        "count_sent": 3,
        "count_received": None,
        "count_mode": "manual",
        "created_at": PLACEHOLDER_TS,
        "updated_at": PLACEHOLDER_TS,
        "_deleted": False,
    }
    doc.update(overrides)
    return doc


async def test_editing_count_sent_after_send_is_rejected(
    authed_client: AsyncClient, test_user: User
) -> None:
    load_id = str(uuid.uuid4())
    await push_create(authed_client, "loads", load_doc(load_id, test_user.id))

    category_id = str(uuid.uuid4())
    await push_create(authed_client, "load_item_categories", _category_doc(category_id, load_id))

    # Send the load (freezes total_sent, spec §4.6) directly via push.
    pulled_load = (await authed_client.get("/sync/loads")).json()["documents"][0]
    sent_load = {**pulled_load, "status": "sent", "total_sent": 3}
    resp = await push_update(authed_client, "loads", sent_load, pulled_load)
    assert resp == []

    # Attempting to edit count_sent on a category of a sent load is rejected
    # as a conflict — the illegal write reverts on the client's next merge.
    pulled_category = (await authed_client.get("/sync/load_item_categories")).json()["documents"][0]
    bad_edit = {**pulled_category, "count_sent": 99}
    conflicts = await push_update(authed_client, "load_item_categories", bad_edit, pulled_category)
    assert len(conflicts) == 1
    assert conflicts[0]["count_sent"] == 3


async def test_count_received_stays_writable_after_send(
    authed_client: AsyncClient, test_user: User
) -> None:
    load_id = str(uuid.uuid4())
    await push_create(authed_client, "loads", load_doc(load_id, test_user.id))
    category_id = str(uuid.uuid4())
    await push_create(authed_client, "load_item_categories", _category_doc(category_id, load_id))
    pulled_load = (await authed_client.get("/sync/loads")).json()["documents"][0]
    await push_update(
        authed_client, "loads", {**pulled_load, "status": "sent", "total_sent": 3}, pulled_load
    )

    pulled_category = (await authed_client.get("/sync/load_item_categories")).json()["documents"][0]
    edit = {**pulled_category, "count_received": 3}
    resp = await push_update(authed_client, "load_item_categories", edit, pulled_category)
    assert resp == []

    refetched = (await authed_client.get("/sync/load_item_categories")).json()["documents"][0]
    assert refetched["count_received"] == 3
    assert refetched["count_sent"] == 3


async def test_photo_link_push_retries_when_its_target_has_not_replicated_yet(
    authed_client: AsyncClient, test_user: User
) -> None:
    """Collections replicate independently, so a photo_link can reach the
    server before the load_item it points at. That must be a retryable failure,
    not a conflict: a rejected create has no master doc to return, and the
    client would read the empty conflict as success and drop the link forever
    (which is exactly what silently lost photo links before)."""
    photo_id = str(uuid.uuid4())
    unknown_item_id = str(uuid.uuid4())

    resp = await authed_client.post(
        "/sync/photo_links",
        json=[
            {
                "new_document_state": {
                    "id": str(uuid.uuid4()),
                    "photo_id": photo_id,
                    "entity_type": "load_item",
                    "entity_id": unknown_item_id,
                    "is_primary": True,
                    "created_at": PLACEHOLDER_TS,
                    "updated_at": PLACEHOLDER_TS,
                    "_deleted": False,
                },
                "assumed_master_state": None,
            }
        ],
    )

    assert resp.status_code == 409


async def test_photo_link_push_rejects_another_users_target_as_a_conflict(
    authed_client: AsyncClient, test_user: User, db_session: AsyncSession
) -> None:
    """A target that *does* exist but belongs to someone else is a genuine
    rejection — a conflict, not a retry (retrying would spin forever)."""
    other = User(sub="zitadel|other-owner", email="other-owner@example.com")
    db_session.add(other)
    await db_session.commit()

    other_load_id = uuid.uuid4()
    db_session.add(Load(id=other_load_id, user_id=other.id, name="theirs", status=LoadStatus.draft))
    await db_session.commit()

    resp = await authed_client.post(
        "/sync/photo_links",
        json=[
            {
                "new_document_state": {
                    "id": str(uuid.uuid4()),
                    "photo_id": str(uuid.uuid4()),
                    "entity_type": "load",
                    "entity_id": str(other_load_id),
                    "is_primary": True,
                    "created_at": PLACEHOLDER_TS,
                    "updated_at": PLACEHOLDER_TS,
                    "_deleted": False,
                },
                "assumed_master_state": None,
            }
        ],
    )

    assert resp.status_code == 200
    assert resp.json() == [None]  # conflict entry: no master doc for a rejected create
