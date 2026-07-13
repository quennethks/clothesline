import uuid

from clothesline_db.models import User
from httpx import AsyncClient

from clothesline_tests.conftest import load_doc, push_create


async def test_pulled_timestamps_end_in_z_not_offset(
    authed_client: AsyncClient, test_user: User
) -> None:
    """Guards a genuinely easy mistake: the default serialization of a
    tz-aware datetime produces '+00:00', not the trailing 'Z' spec §4
    requires on the wire."""
    load_id = str(uuid.uuid4())
    await push_create(authed_client, "loads", load_doc(load_id, test_user.id))

    doc = (await authed_client.get("/sync/loads")).json()["documents"][0]
    assert doc["updated_at"].endswith("Z")
    assert doc["created_at"].endswith("Z")
    assert "+00:00" not in doc["updated_at"]
    assert "+00:00" not in doc["created_at"]
