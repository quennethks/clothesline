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

        # There is deliberately no check on an incoming `user_id`: it is this
        # collection's server-authored `owner_field`, so the push path drops
        # the client's value and stamps the principal instead — leaving nothing
        # to disagree with. The check that stood here rejected a load whose
        # stamped owner didn't match the caller, and no retry could ever clear
        # it, because the value was already baked into a stored document. That
        # made a single database reset (which mints a new `users.id` for the
        # same Zitadel `sub`) strand every load a device was holding.

        if existing is None:
            return

        if existing.status in (LoadStatus.sent, LoadStatus.closed):
            incoming_total_sent = incoming.get("total_sent")
            if incoming_total_sent is not None and incoming_total_sent != existing.total_sent:
                raise PushValidationError("total_sent is frozen once sent")
            if incoming.get("status") == LoadStatus.draft:
                raise PushValidationError("a sent/closed load cannot revert to draft")
