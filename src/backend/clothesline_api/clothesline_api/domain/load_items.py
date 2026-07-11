import uuid
from typing import Any

from clothesline_db.models import Load, LoadItem, LoadItemCategory
from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from clothesline_api.domain.common import PushNotReadyError, PushValidationError


def _select_owner_user_id(category_id: uuid.UUID) -> Select[Any]:
    return (
        select(Load.user_id)
        .select_from(LoadItemCategory)
        .join(Load, Load.id == LoadItemCategory.load_id)
        .where(LoadItemCategory.id == category_id)
    )


class LoadItemValidator:
    """Ownership-chain check only — no freeze invariant. LoadItems keep
    being created/removed by photo capture even after the parent load is
    sent (spec §4.4); they just stop *driving the count* once manual."""

    async def validate(
        self,
        session: AsyncSession,
        user_id: uuid.UUID,
        existing: LoadItem | None,
        incoming: dict[str, object],
    ) -> None:
        category_id = incoming.get("load_item_category_id") or (
            existing.load_item_category_id if existing else None
        )
        if category_id is None:
            raise PushValidationError("load_item_category_id is required")
        assert isinstance(category_id, uuid.UUID)

        result = await session.execute(_select_owner_user_id(category_id))
        owner_user_id = result.scalar_one_or_none()
        if owner_user_id is None:
            # The parent category hasn't replicated yet — retry, don't reject.
            raise PushNotReadyError(f"category {category_id} has not replicated yet")
        if owner_user_id != user_id:
            raise PushValidationError("not your load item")
