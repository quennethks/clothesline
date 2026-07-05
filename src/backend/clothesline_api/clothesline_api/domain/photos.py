import uuid

from clothesline_db.models import Photo
from sqlalchemy.ext.asyncio import AsyncSession


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
