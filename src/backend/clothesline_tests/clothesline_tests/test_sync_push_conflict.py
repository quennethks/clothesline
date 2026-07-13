import uuid

from clothesline_db.models import User
from httpx import AsyncClient

from clothesline_tests.conftest import load_doc, push_create, push_update


async def test_stale_assumed_master_state_returns_current_master(
    authed_client: AsyncClient, test_user: User
) -> None:
    load_id = str(uuid.uuid4())
    await push_create(authed_client, "loads", load_doc(load_id, test_user.id))

    pulled = await authed_client.get("/sync/loads")
    master_doc = pulled.json()["documents"][0]

    # "Client A" applies a change based on the real, current master state.
    resp_a = await push_update(
        authed_client, "loads", {**master_doc, "shop_name": "From A"}, master_doc
    )
    assert resp_a == []

    # "Client B" still assumes the OLD master_doc is current (it hasn't
    # pulled Client A's change yet) — its push is stale and conflicts.
    resp_b = await push_update(
        authed_client, "loads", {**master_doc, "shop_name": "From B"}, master_doc
    )
    assert len(resp_b) == 1
    assert resp_b[0]["shop_name"] == "From A"  # A's write stands; B's was not applied
