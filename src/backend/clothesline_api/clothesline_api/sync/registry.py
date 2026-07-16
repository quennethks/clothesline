import uuid
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date
from typing import Any

from clothesline_db.models import Load, LoadItem, LoadItemCategory, Photo, PhotoLink, SyncedMixin
from sqlalchemy import Select

from clothesline_api.domain import common as domain_common
from clothesline_api.domain.load_item_categories import LoadItemCategoryValidator
from clothesline_api.domain.load_items import LoadItemValidator
from clothesline_api.domain.loads import LoadValidator
from clothesline_api.domain.photo_links import PhotoLinkValidator
from clothesline_api.domain.photos import PhotoValidator


def _uuid(value: object) -> object:
    return uuid.UUID(value) if isinstance(value, str) else value


def _date_or_none(value: object) -> object:
    return date.fromisoformat(value) if isinstance(value, str) else value


@dataclass(frozen=True)
class SyncCollection:
    name: str
    model: type[SyncedMixin]
    # writable/readable columns beyond id/created_at/updated_at/deleted_at,
    # which every synced entity shares (spec §4) and the pull/push handlers
    # already treat generically.
    fields: tuple[str, ...]
    validator: object  # implements domain.common.PushValidator
    owner_filter: Callable[[Select[Any], uuid.UUID], Select[Any]]
    parsers: dict[str, Callable[[object], object]] = field(default_factory=dict)
    # The column holding the owning user's id. Server-authored: it is in
    # `fields` so pulls still return it, but the push path never lets a client
    # write it — the server stamps it from the authenticated principal, which
    # it resolves from the Zitadel `sub` on every request anyway.
    #
    # The client used to send this, which made it the one field where the
    # client asserted an identity the server already owned. `users.id` is a
    # uuid4 minted per row, so recreating the users row (any database reset)
    # renumbered the user and instantly invalidated every load a device had
    # already stamped — unfixable by retry, because the value can never match
    # again. A value the client cannot write is a value that cannot go stale.
    #
    # Only `loads` stores the owner directly; every other collection derives
    # ownership through its parent (see `owner_filter`).
    owner_field: str | None = None


REGISTRY: dict[str, SyncCollection] = {
    "loads": SyncCollection(
        name="loads",
        model=Load,
        fields=(
            "user_id",
            "name",
            "shop_name",
            "shop_location",
            "send_date",
            "status",
            "total_sent",
            "total_received",
            "reconciled",
        ),
        validator=LoadValidator(),
        owner_filter=domain_common.loads_owner_filter,
        # No `user_id` parser: it is owner_field, so the push path drops the
        # client's value before parsing and the server stamps a real UUID.
        parsers={"send_date": _date_or_none},
        owner_field="user_id",
    ),
    "load_item_categories": SyncCollection(
        name="load_item_categories",
        model=LoadItemCategory,
        fields=("load_id", "category", "count_sent", "count_received", "count_mode"),
        validator=LoadItemCategoryValidator(),
        owner_filter=domain_common.load_item_categories_owner_filter,
        parsers={"load_id": _uuid},
    ),
    "load_items": SyncCollection(
        name="load_items",
        model=LoadItem,
        fields=("load_item_category_id", "name"),
        validator=LoadItemValidator(),
        owner_filter=domain_common.load_items_owner_filter,
        parsers={"load_item_category_id": _uuid},
    ),
    "photos": SyncCollection(
        name="photos",
        model=Photo,
        fields=("blob_key", "content_type"),
        validator=PhotoValidator(),
        owner_filter=domain_common.photos_owner_filter,
    ),
    "photo_links": SyncCollection(
        name="photo_links",
        model=PhotoLink,
        fields=("photo_id", "entity_type", "entity_id", "is_primary"),
        validator=PhotoLinkValidator(),
        owner_filter=domain_common.photo_links_owner_filter,
        parsers={"photo_id": _uuid, "entity_id": _uuid},
    ),
}
