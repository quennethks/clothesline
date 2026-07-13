from clothesline_db.models import CountMode, Load, LoadItem, LoadItemCategory, User
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


async def test_load_with_categories_and_items_roundtrips(db_session: AsyncSession) -> None:
    user = User(sub="zitadel|abc123", email="launderer@example.com")
    db_session.add(user)
    await db_session.flush()

    load = Load(user_id=user.id, name="2026-07-04", shop_name="Wash & Fold")
    db_session.add(load)
    await db_session.flush()

    category = LoadItemCategory(load_id=load.id, category="Shirts", count_sent=3)
    db_session.add(category)
    await db_session.flush()

    item = LoadItem(load_item_category_id=category.id, name="Shirts")
    db_session.add(item)
    await db_session.commit()

    reloaded = (await db_session.execute(select(Load).where(Load.id == load.id))).scalar_one()
    assert reloaded.name == "2026-07-04"
    assert reloaded.shop_name == "Wash & Fold"
    assert reloaded.updated_at is not None
    assert reloaded.created_at is not None

    reloaded_category = (
        await db_session.execute(
            select(LoadItemCategory).where(LoadItemCategory.load_id == load.id)
        )
    ).scalar_one()
    assert reloaded_category.category == "Shirts"
    assert reloaded_category.count_sent == 3
    assert reloaded_category.count_mode == CountMode.auto

    reloaded_item = (
        await db_session.execute(
            select(LoadItem).where(LoadItem.load_item_category_id == category.id)
        )
    ).scalar_one()
    assert reloaded_item.name == "Shirts"
    assert reloaded_item.id == item.id


async def test_arbitrary_category_string_is_accepted(db_session: AsyncSession) -> None:
    """No backend allow-list on LoadItemCategory.category (spec §4.3) — custom,
    user-typed category strings must be accepted as plain free text."""
    user = User(sub="zitadel|def456", email="another@example.com")
    db_session.add(user)
    await db_session.flush()

    load = Load(user_id=user.id, name="2026-07-04")
    db_session.add(load)
    await db_session.flush()

    category = LoadItemCategory(load_id=load.id, category="Grandma's Doilies")
    db_session.add(category)
    await db_session.commit()

    reloaded = (
        await db_session.execute(select(LoadItemCategory).where(LoadItemCategory.id == category.id))
    ).scalar_one()
    assert reloaded.category == "Grandma's Doilies"
