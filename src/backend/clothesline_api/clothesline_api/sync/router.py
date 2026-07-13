from typing import Any

from clothesline_db.models import User
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from clothesline_api.auth.dependencies import get_current_user
from clothesline_api.common.deps import get_db_session
from clothesline_api.sync.pull import handle_pull
from clothesline_api.sync.push import handle_push
from clothesline_api.sync.registry import REGISTRY

router = APIRouter(prefix="/sync", tags=["sync"])


@router.get("/{collection_name}")
async def pull(
    collection_name: str,
    id: str | None = Query(default=None),
    updated_at: str | None = Query(default=None),
    batch_size: int = Query(default=100, le=1000),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    collection = REGISTRY.get(collection_name)
    if collection is None:
        raise HTTPException(status_code=404, detail=f"unknown collection: {collection_name}")
    return await handle_pull(session, collection, user.id, id, updated_at, batch_size)


@router.post("/{collection_name}")
async def push(
    collection_name: str,
    rows: list[dict[str, Any]],
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict[str, Any] | None]:
    if collection_name not in REGISTRY:
        raise HTTPException(status_code=404, detail=f"unknown collection: {collection_name}")
    return await handle_push(session, collection_name, user.id, rows)
