import uuid

from clothesline_api.auth.dependencies import get_current_user
from clothesline_api.main import app
from clothesline_db.models import User
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from clothesline_tests.conftest import PLACEHOLDER_TS, load_doc, push_create


def _as(user: User) -> None:
    app.dependency_overrides[get_current_user] = lambda: user


async def _make_users(db_session: AsyncSession) -> tuple[User, User]:
    user_a = User(sub="zitadel|owner-a", email="a@example.com")
    user_b = User(sub="zitadel|owner-b", email="b@example.com")
    db_session.add_all([user_a, user_b])
    await db_session.commit()
    return user_a, user_b


async def test_user_a_never_sees_user_b_loads(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    user_a, user_b = await _make_users(db_session)

    _as(user_a)
    load_a_id = str(uuid.uuid4())
    await push_create(client, "loads", load_doc(load_a_id, user_a.id))

    _as(user_b)
    load_b_id = str(uuid.uuid4())
    await push_create(client, "loads", load_doc(load_b_id, user_b.id))

    pulled_b = await client.get("/sync/loads")
    ids_b = [d["id"] for d in pulled_b.json()["documents"]]
    assert load_b_id in ids_b
    assert load_a_id not in ids_b

    _as(user_a)
    pulled_a = await client.get("/sync/loads")
    ids_a = [d["id"] for d in pulled_a.json()["documents"]]
    assert load_a_id in ids_a
    assert load_b_id not in ids_a

    app.dependency_overrides.pop(get_current_user, None)


async def test_photos_and_photo_links_scoped_through_the_polymorphic_chain(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """The hardest ownership case (spec §4.1): photos/photo_links have no
    direct FK to Load — ownership only exists via PhotoLink.entity_id
    walking up to loads.user_id. A bug here wouldn't surface from any UI
    (nothing creates photos until M6), only from a test like this one."""
    user_a, user_b = await _make_users(db_session)

    _as(user_a)
    load_id = str(uuid.uuid4())
    await push_create(client, "loads", load_doc(load_id, user_a.id))

    photo_id = str(uuid.uuid4())
    photo_doc: dict[str, object] = {
        "id": photo_id,
        "blob_key": None,
        "content_type": None,
        "created_at": PLACEHOLDER_TS,
        "updated_at": PLACEHOLDER_TS,
        "_deleted": False,
    }
    resp_photo = await push_create(client, "photos", photo_doc)
    assert resp_photo == []

    link_id = str(uuid.uuid4())
    link_doc: dict[str, object] = {
        "id": link_id,
        "photo_id": photo_id,
        "entity_type": "load",
        "entity_id": load_id,
        "is_primary": True,
        "created_at": PLACEHOLDER_TS,
        "updated_at": PLACEHOLDER_TS,
        "_deleted": False,
    }
    resp_link = await push_create(client, "photo_links", link_doc)
    assert resp_link == []

    # user A (the owner) sees both, via the chain.
    links_a = (await client.get("/sync/photo_links")).json()["documents"]
    assert any(d["id"] == link_id for d in links_a)
    photos_a = (await client.get("/sync/photos")).json()["documents"]
    assert any(d["id"] == photo_id for d in photos_a)

    # user B (not the owner) sees neither.
    _as(user_b)
    links_b = (await client.get("/sync/photo_links")).json()["documents"]
    assert not any(d["id"] == link_id for d in links_b)
    photos_b = (await client.get("/sync/photos")).json()["documents"]
    assert not any(d["id"] == photo_id for d in photos_b)

    # ...and user B can't push a link claiming ownership of user A's load —
    # the push-time chain-walk (domain.photo_links.PhotoLinkValidator)
    # rejects it as a conflict (a bare Photo carries no owner of its own,
    # so this is the only place that ownership gate can live).
    rogue_photo_id = str(uuid.uuid4())
    await push_create(client, "photos", {**photo_doc, "id": rogue_photo_id})
    resp_rogue = await push_create(
        client,
        "photo_links",
        {**link_doc, "id": str(uuid.uuid4()), "photo_id": rogue_photo_id},
    )
    assert len(resp_rogue) == 1
    assert resp_rogue[0] is None  # rejected create: no master doc exists to return

    app.dependency_overrides.pop(get_current_user, None)
