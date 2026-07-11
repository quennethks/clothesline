import uuid

from clothesline_db.models import User
from httpx import AsyncClient

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
