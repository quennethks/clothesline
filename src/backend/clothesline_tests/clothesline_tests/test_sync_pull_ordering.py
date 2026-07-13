import uuid

from clothesline_db.models import User
from httpx import AsyncClient

from clothesline_tests.conftest import load_doc, push_create


async def test_pull_orders_by_updated_at_then_id(
    authed_client: AsyncClient, test_user: User
) -> None:
    id1, id2, id3 = (str(uuid.uuid4()) for _ in range(3))
    await push_create(authed_client, "loads", load_doc(id1, test_user.id, name="first"))
    await push_create(authed_client, "loads", load_doc(id2, test_user.id, name="second"))
    await push_create(authed_client, "loads", load_doc(id3, test_user.id, name="third"))

    resp = await authed_client.get("/sync/loads")
    assert resp.status_code == 200
    ids = [doc["id"] for doc in resp.json()["documents"]]
    assert ids == [id1, id2, id3]


async def test_pull_checkpoint_iterates_across_multiple_pages(
    authed_client: AsyncClient, test_user: User
) -> None:
    id1, id2, id3 = (str(uuid.uuid4()) for _ in range(3))
    await push_create(authed_client, "loads", load_doc(id1, test_user.id, name="first"))
    await push_create(authed_client, "loads", load_doc(id2, test_user.id, name="second"))
    await push_create(authed_client, "loads", load_doc(id3, test_user.id, name="third"))

    first_page = await authed_client.get("/sync/loads", params={"batch_size": 2})
    body1 = first_page.json()
    assert [d["id"] for d in body1["documents"]] == [id1, id2]

    checkpoint = body1["checkpoint"]
    second_page = await authed_client.get(
        "/sync/loads",
        params={"id": checkpoint["id"], "updated_at": checkpoint["updated_at"], "batch_size": 2},
    )
    body2 = second_page.json()
    assert [d["id"] for d in body2["documents"]] == [id3]

    # A third pull from the new checkpoint returns nothing further.
    third_page = await authed_client.get(
        "/sync/loads",
        params={
            "id": body2["checkpoint"]["id"],
            "updated_at": body2["checkpoint"]["updated_at"],
        },
    )
    assert third_page.json()["documents"] == []
