import uuid

from clothesline_db.models import Photo
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from clothesline_api.domain.common import photos_owner_filter


async def get_owned_photo(
    session: AsyncSession, *, user_id: uuid.UUID, photo_id: uuid.UUID
) -> Photo | None:
    """The gate for the /media read path: a photo is the user's only if one of
    its PhotoLinks resolves up the chain to a Load they own (spec §8.4) —
    the same condition the sync pull scopes by."""
    stmt = photos_owner_filter(select(Photo), user_id).where(
        Photo.id == photo_id, Photo.deleted_at.is_(None)
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


class PhotoValidator:
    """A bare Photo row carries no ownership info of its own — it's only
    established once a PhotoLink points to it (spec §4.1). There is nothing
    ownership-sensitive to check here at push time; the actual gate is the
    PhotoLink validator (photo_links.py) and, later, the /media endpoints
    (M6) that mint SAS URLs for the blob bytes."""

    async def validate(
        self,
        session: AsyncSession,
        user_id: uuid.UUID,
        existing: Photo | None,
        incoming: dict[str, object],
    ) -> None:
        return
