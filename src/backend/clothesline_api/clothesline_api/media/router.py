import uuid

from clothesline_db.models import User
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from clothesline_api.auth.dependencies import get_current_user
from clothesline_api.common.deps import get_db_session
from clothesline_api.domain.photos import get_owned_photo
from clothesline_api.media import blob

router = APIRouter(prefix="/media", tags=["media"])


class UploadUrlRequest(BaseModel):
    photo_id: uuid.UUID
    content_type: str


class UploadUrlResponse(BaseModel):
    blob_key: str
    upload_url: str
    expires_at: str


class ReadUrlResponse(BaseModel):
    url: str
    expires_at: str


@router.post("/upload-url", response_model=UploadUrlResponse)
async def create_upload_url(
    body: UploadUrlRequest,
    user: User = Depends(get_current_user),
) -> UploadUrlResponse:
    # Deliberately *not* gated on the photo already existing server-side. The
    # upload queue drains bytes as soon as connectivity returns (spec §8.2),
    # which can beat RxDB's push of the photo/photo_link docs — requiring the
    # row here would make that race a hard failure. Safety comes from the key
    # itself: it is user-prefixed (blob_key_for), so a user can only ever
    # write under their own prefix, and the *read* path below is fully
    # ownership-checked against the synced docs.
    blob_key = blob.blob_key_for(user.id, body.photo_id)
    url, expires_at = blob.upload_sas_url(blob_key)
    return UploadUrlResponse(
        blob_key=blob_key,
        upload_url=url,
        expires_at=expires_at.isoformat().replace("+00:00", "Z"),
    )


@router.get("/{photo_id}", response_model=ReadUrlResponse)
async def get_read_url(
    photo_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ReadUrlResponse:
    photo = await get_owned_photo(session, user_id=user.id, photo_id=photo_id)
    if photo is None:
        raise HTTPException(status_code=404, detail="photo not found")
    if photo.blob_key is None:
        # The capturing device hasn't drained its upload queue yet (spec
        # §8.3's pending state) — there are no bytes to hand out.
        raise HTTPException(status_code=404, detail="photo bytes not uploaded yet")

    url, expires_at = blob.read_sas_url(photo.blob_key)
    return ReadUrlResponse(url=url, expires_at=expires_at.isoformat().replace("+00:00", "Z"))
