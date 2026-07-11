import datetime
import uuid

import pytest
from clothesline_api.auth.dependencies import get_current_user
from clothesline_api.main import app
from clothesline_api.media import blob
from clothesline_db.models import User
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from clothesline_tests.conftest import PLACEHOLDER_TS, load_doc, push_create

pytestmark = pytest.mark.asyncio

FAKE_EXPIRY = datetime.datetime(2026, 1, 1, tzinfo=datetime.UTC)


@pytest.fixture
def stub_sas(monkeypatch: pytest.MonkeyPatch) -> None:
    """The /media endpoints' own logic is ownership + key derivation; the SAS
    minting itself is Azure SDK code that needs a live account. Stubbed here
    so these tests stay hermetic (real Blob is exercised in the M8 e2e run
    against Azurite)."""
    monkeypatch.setattr(
        blob, "upload_sas_url", lambda key: (f"https://blob.test/photos/{key}?sig=up", FAKE_EXPIRY)
    )
    monkeypatch.setattr(
        blob, "read_sas_url", lambda key: (f"https://blob.test/photos/{key}?sig=read", FAKE_EXPIRY)
    )


def photo_doc(photo_id: str, **overrides: object) -> dict[str, object]:
    doc: dict[str, object] = {
        "id": photo_id,
        "blob_key": None,
        "content_type": "image/webp",
        "created_at": PLACEHOLDER_TS,
        "updated_at": PLACEHOLDER_TS,
        "_deleted": False,
    }
    doc.update(overrides)
    return doc


def photo_link_doc(link_id: str, photo_id: str, load_id: str) -> dict[str, object]:
    return {
        "id": link_id,
        "photo_id": photo_id,
        "entity_type": "load",
        "entity_id": load_id,
        "is_primary": True,
        "created_at": PLACEHOLDER_TS,
        "updated_at": PLACEHOLDER_TS,
        "_deleted": False,
    }


async def _create_linked_photo(
    client: AsyncClient, user_id: uuid.UUID, *, blob_key: str | None = None
) -> str:
    load_id = str(uuid.uuid4())
    photo_id = str(uuid.uuid4())
    await push_create(client, "loads", load_doc(load_id, user_id))
    await push_create(client, "photos", photo_doc(photo_id, blob_key=blob_key))
    await push_create(client, "photo_links", photo_link_doc(str(uuid.uuid4()), photo_id, load_id))
    return photo_id


async def test_upload_url_is_user_prefixed(
    authed_client: AsyncClient, test_user: User, stub_sas: None
) -> None:
    photo_id = str(uuid.uuid4())
    resp = await authed_client.post(
        "/media/upload-url", json={"photo_id": photo_id, "content_type": "image/webp"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["blob_key"] == f"{test_user.id}/{photo_id}"
    assert body["expires_at"].endswith("Z")


async def test_upload_url_does_not_require_the_photo_doc_to_have_synced_yet(
    authed_client: AsyncClient, stub_sas: None
) -> None:
    # The upload queue can drain bytes before RxDB has pushed the photo doc
    # (spec §8.2) — that race must not fail the upload.
    resp = await authed_client.post(
        "/media/upload-url",
        json={"photo_id": str(uuid.uuid4()), "content_type": "image/webp"},
    )
    assert resp.status_code == 200


async def test_read_url_for_an_owned_uploaded_photo(
    authed_client: AsyncClient, test_user: User, stub_sas: None
) -> None:
    blob_key = f"{test_user.id}/some-photo"
    photo_id = await _create_linked_photo(authed_client, test_user.id, blob_key=blob_key)

    resp = await authed_client.get(f"/media/{photo_id}")
    assert resp.status_code == 200
    assert resp.json()["url"] == f"https://blob.test/photos/{blob_key}?sig=read"


async def test_read_url_404s_while_bytes_are_still_pending(
    authed_client: AsyncClient, test_user: User, stub_sas: None
) -> None:
    photo_id = await _create_linked_photo(authed_client, test_user.id, blob_key=None)
    resp = await authed_client.get(f"/media/{photo_id}")
    assert resp.status_code == 404


async def test_read_url_404s_for_another_users_photo(
    authed_client: AsyncClient,
    test_user: User,
    db_session: AsyncSession,
    stub_sas: None,
) -> None:
    photo_id = await _create_linked_photo(
        authed_client, test_user.id, blob_key=f"{test_user.id}/some-photo"
    )

    other = User(sub="zitadel|other-user", email="other@example.com")
    db_session.add(other)
    await db_session.commit()
    app.dependency_overrides[get_current_user] = lambda: other
    try:
        resp = await authed_client.get(f"/media/{photo_id}")
    finally:
        app.dependency_overrides[get_current_user] = lambda: test_user
    assert resp.status_code == 404


async def test_read_url_404s_for_an_unknown_photo(
    authed_client: AsyncClient, stub_sas: None
) -> None:
    resp = await authed_client.get(f"/media/{uuid.uuid4()}")
    assert resp.status_code == 404
