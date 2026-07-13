import uuid

from clothesline_db.models import Load, LoadStatus
from sqlalchemy.ext.asyncio import AsyncSession

from clothesline_api.domain.common import PushValidationError


class LoadValidator:
    """Ownership check plus the read-only-sent-manifest invariant (spec
    §4.6/§5.4): once a load is sent or closed, total_sent is frozen and it
    can't be moved back to draft. Everything else (total_received, status
    sent->closed, reconciled) stays freely writable."""

    async def validate(
        self,
        session: AsyncSession,
        user_id: uuid.UUID,
        existing: Load | None,
        incoming: dict[str, object],
    ) -> None:
        if existing is not None and existing.user_id != user_id:
            raise PushValidationError("not your load")
        incoming_user_id = incoming.get("user_id")
        if incoming_user_id is not None and incoming_user_id != user_id:
            raise PushValidationError("cannot assign a load to another user")

        if existing is None:
            return

        if existing.status in (LoadStatus.sent, LoadStatus.closed):
            incoming_total_sent = incoming.get("total_sent")
            if incoming_total_sent is not None and incoming_total_sent != existing.total_sent:
                raise PushValidationError("total_sent is frozen once sent")
            if incoming.get("status") == LoadStatus.draft:
                raise PushValidationError("a sent/closed load cannot revert to draft")
