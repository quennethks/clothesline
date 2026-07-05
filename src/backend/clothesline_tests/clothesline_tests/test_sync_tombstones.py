import uuid

from clothesline_db.models import User
from httpx import AsyncClient

from clothesline_tests.conftest import load_doc, push_create, push_update

_EPOCH = "1970-01-01T00:00:00.000Z"


async def test_delete_replicates_as_deleted_true_tombstone(
    authed_client: AsyncClient, test_user: User
) -> None:
    load_id = str(uuid.uuid4())
    await push_create(authed_client, "loads", load_doc(load_id, test_user.id))
    master_doc = (await authed_client.get("/sync/loads")).json()["documents"][0]

    resp = await push_update(authed_client, "loads", {**master_doc, "_deleted": True}, master_doc)
    assert resp == []

    # A pull from before the delete's checkpoint still returns the doc, now
    # with _deleted true — it replicates as a tombstone, not a vanished row.
    resp2 = await authed_client.get("/sync/loads", params={"updated_at": _EPOCH})
    doc = next(d for d in resp2.json()["documents"] if d["id"] == load_id)
    assert doc["_deleted"] is True
