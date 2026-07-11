import uuid

from clothesline_db.models import Load, LoadItemCategory, LoadStatus
from sqlalchemy.ext.asyncio import AsyncSession

from clothesline_api.domain.common import PushNotReadyError, PushValidationError


class LoadItemCategoryValidator:
    """Ownership via the parent Load, plus: once the parent Load is sent or
    closed, count_sent/count_mode are frozen (they're what total_sent was
    computed from) — count_received stays writable anytime (spec §5.4)."""

    async def validate(
        self,
        session: AsyncSession,
        user_id: uuid.UUID,
        existing: LoadItemCategory | None,
        incoming: dict[str, object],
    ) -> None:
        load_id = incoming.get("load_id") or (existing.load_id if existing else None)
        if load_id is None:
            raise PushValidationError("load_id is required")

        load = await session.get(Load, load_id)
        if load is None:
            # The Load's own push hasn't landed yet — retry, don't reject.
            raise PushNotReadyError(f"load {load_id} has not replicated yet")
        if load.user_id != user_id:
            raise PushValidationError("not your load")

        if existing is None:
            return

        if load.status in (LoadStatus.sent, LoadStatus.closed):
            incoming_count_sent = incoming.get("count_sent")
            if incoming_count_sent is not None and incoming_count_sent != existing.count_sent:
                raise PushValidationError("count_sent is frozen once the load is sent")
            incoming_count_mode = incoming.get("count_mode")
            if incoming_count_mode is not None and incoming_count_mode != existing.count_mode:
                raise PushValidationError("count_mode is frozen once the load is sent")
