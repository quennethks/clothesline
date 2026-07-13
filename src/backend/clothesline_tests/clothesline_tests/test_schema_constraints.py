import pytest
from clothesline_db.models import (
    Load,
    LoadItemCategory,
    Photo,
    PhotoLink,
    PhotoLinkEntityType,
    User,
)
from sqlalchemy import Connection, inspect
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession


async def test_duplicate_photo_link_rejected(db_session: AsyncSession) -> None:
    user = User(sub="zitadel|photolink", email="photo@example.com")
    db_session.add(user)
    await db_session.flush()

    load = Load(user_id=user.id, name="2026-07-04")
    db_session.add(load)
    await db_session.flush()

    photo = Photo()
    db_session.add(photo)
    await db_session.flush()

    link = PhotoLink(photo_id=photo.id, entity_type=PhotoLinkEntityType.load, entity_id=load.id)
    db_session.add(link)
    await db_session.commit()

    dup = PhotoLink(photo_id=photo.id, entity_type=PhotoLinkEntityType.load, entity_id=load.id)
    db_session.add(dup)
    with pytest.raises(IntegrityError):
        await db_session.commit()


async def test_photo_link_entity_lookup_index_exists(migrated_engine: AsyncEngine) -> None:
    def _index_names(sync_conn: Connection) -> set[str]:
        inspector = inspect(sync_conn)
        return {ix["name"] for ix in inspector.get_indexes("photo_links") if ix["name"]}

    async with migrated_engine.connect() as conn:
        names = await conn.run_sync(_index_names)

    assert "ix_photo_links_entity_type_entity_id" in names


async def test_load_item_category_count_mode_defaults_auto(db_session: AsyncSession) -> None:
    user = User(sub="zitadel|countmode", email="count@example.com")
    db_session.add(user)
    await db_session.flush()

    load = Load(user_id=user.id, name="2026-07-04")
    db_session.add(load)
    await db_session.flush()

    category = LoadItemCategory(load_id=load.id, category="Socks")
    db_session.add(category)
    await db_session.commit()

    assert category.count_mode.value == "auto"
    assert category.count_sent == 0
