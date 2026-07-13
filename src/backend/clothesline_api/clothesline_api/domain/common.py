import uuid
from typing import Any, Protocol

from clothesline_db.models import (
    Load,
    LoadItem,
    LoadItemCategory,
    Photo,
    PhotoLink,
    PhotoLinkEntityType,
)
from sqlalchemy import ColumnElement, Select, and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession


class PushValidationError(Exception):
    """Raised by a validator to reject a push. The push handler catches this
    and returns the current master doc as a conflict (spec §5.1/§5.2) —
    the same mechanism used for a stale assumed_master_state, so an illegal
    write reverts on the client's next merge instead of getting a 4xx."""


class PushNotReadyError(Exception):
    """Raised when a doc's parent hasn't replicated *yet* — not a rule
    violation, just an ordering race.

    Each collection replicates independently (spec §7), so a child can reach
    the server before its parent: a photo_link naming a load_item that is
    still in the load_items collection's own push queue, for instance. Its
    ownership can't be resolved yet, but rejecting it as a conflict would be
    wrong and destructive — a rejected *create* has no master doc to hand
    back, so the client would take the empty conflict as success and drop the
    row forever. Instead the push fails outright and RxDB retries it, by which
    time the parent has landed.
    """


class PushValidator(Protocol):
    async def validate(
        self,
        session: AsyncSession,
        user_id: uuid.UUID,
        existing: object | None,
        incoming: dict[str, object],
    ) -> None: ...


async def resolve_owner_user_id(
    session: AsyncSession,
    entity_type: PhotoLinkEntityType,
    entity_id: uuid.UUID,
) -> uuid.UUID | None:
    """Resolves the owning user of a polymorphic PhotoLink target by walking
    up its chain to Load.user_id — the only place ownership is recorded.
    Used to validate a new/updated PhotoLink at push time."""
    if entity_type == PhotoLinkEntityType.load:
        stmt = select(Load.user_id).where(Load.id == entity_id)
    elif entity_type == PhotoLinkEntityType.load_item_category:
        stmt = (
            select(Load.user_id)
            .select_from(LoadItemCategory)
            .join(Load, Load.id == LoadItemCategory.load_id)
            .where(LoadItemCategory.id == entity_id)
        )
    else:
        stmt = (
            select(Load.user_id)
            .select_from(LoadItem)
            .join(LoadItemCategory, LoadItemCategory.id == LoadItem.load_item_category_id)
            .join(Load, Load.id == LoadItemCategory.load_id)
            .where(LoadItem.id == entity_id)
        )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


def owned_photo_link_condition(user_id: uuid.UUID) -> ColumnElement[bool]:
    """A boolean SQL clause over PhotoLink's own entity_type/entity_id
    columns: true if the link's target resolves to a Load owned by
    user_id. One branch per polymorphic entity_type, each joining up its
    own chain to loads.user_id (spec §4.1's polymorphic junction)."""
    owned_load_ids = select(Load.id).where(Load.user_id == user_id)
    owned_category_ids = (
        select(LoadItemCategory.id)
        .join(Load, Load.id == LoadItemCategory.load_id)
        .where(Load.user_id == user_id)
    )
    owned_item_ids = (
        select(LoadItem.id)
        .join(LoadItemCategory, LoadItemCategory.id == LoadItem.load_item_category_id)
        .join(Load, Load.id == LoadItemCategory.load_id)
        .where(Load.user_id == user_id)
    )
    return or_(
        and_(
            PhotoLink.entity_type == PhotoLinkEntityType.load,
            PhotoLink.entity_id.in_(owned_load_ids),
        ),
        and_(
            PhotoLink.entity_type == PhotoLinkEntityType.load_item_category,
            PhotoLink.entity_id.in_(owned_category_ids),
        ),
        and_(
            PhotoLink.entity_type == PhotoLinkEntityType.load_item,
            PhotoLink.entity_id.in_(owned_item_ids),
        ),
    )


def loads_owner_filter(stmt: Select[Any], user_id: uuid.UUID) -> Select[Any]:
    return stmt.where(Load.user_id == user_id)


def load_item_categories_owner_filter(stmt: Select[Any], user_id: uuid.UUID) -> Select[Any]:
    return stmt.join(Load, Load.id == LoadItemCategory.load_id).where(Load.user_id == user_id)


def load_items_owner_filter(stmt: Select[Any], user_id: uuid.UUID) -> Select[Any]:
    return (
        stmt.join(LoadItemCategory, LoadItemCategory.id == LoadItem.load_item_category_id)
        .join(Load, Load.id == LoadItemCategory.load_id)
        .where(Load.user_id == user_id)
    )


def photo_links_owner_filter(stmt: Select[Any], user_id: uuid.UUID) -> Select[Any]:
    return stmt.where(owned_photo_link_condition(user_id))


def photos_owner_filter(stmt: Select[Any], user_id: uuid.UUID) -> Select[Any]:
    # A photo is visible once at least one of its links resolves to an
    # owned entity — a photo pushed before its link (spec §8.2's capture
    # order) is transiently invisible to *other* devices until the link
    # replicates too, but the capturing device already has it locally
    # (RxDB is the system of record during the session, spec §5.1).
    owned_photo_ids = select(PhotoLink.photo_id).where(owned_photo_link_condition(user_id))
    return stmt.where(Photo.id.in_(owned_photo_ids))
