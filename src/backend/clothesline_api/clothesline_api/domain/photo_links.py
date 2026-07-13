import uuid

from clothesline_db.models import PhotoLink, PhotoLinkEntityType
from sqlalchemy.ext.asyncio import AsyncSession

from clothesline_api.domain.common import (
    PushNotReadyError,
    PushValidationError,
    resolve_owner_user_id,
)


class PhotoLinkValidator:
    """Validates that a new/updated link's polymorphic target actually
    belongs to the pushing user, walking the same chain used for pull
    scoping (spec §4.1's polymorphic junction — entity_type/entity_id isn't
    a DB FK, so this is the only place that's enforced)."""

    async def validate(
        self,
        session: AsyncSession,
        user_id: uuid.UUID,
        existing: PhotoLink | None,
        incoming: dict[str, object],
    ) -> None:
        entity_type = incoming.get("entity_type") or (existing.entity_type if existing else None)
        entity_id = incoming.get("entity_id") or (existing.entity_id if existing else None)
        if entity_type is None or entity_id is None:
            raise PushValidationError("entity_type and entity_id are required")
        assert isinstance(entity_type, str)  # PhotoLinkEntityType is a str subtype (StrEnum)
        assert isinstance(entity_id, uuid.UUID)

        owner_user_id = await resolve_owner_user_id(
            session, PhotoLinkEntityType(entity_type), entity_id
        )
        if owner_user_id is None:
            # The target (typically the auto-created LoadItem, spec §4.4) is
            # still in its own collection's push queue — retry, don't reject.
            raise PushNotReadyError(f"photo link target {entity_id} has not replicated yet")
        if owner_user_id != user_id:
            raise PushValidationError("photo link target is not yours")
