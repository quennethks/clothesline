from clothesline_db.models import User
from fastapi import APIRouter, Depends

from clothesline_api.auth.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me")
async def me(user: User = Depends(get_current_user)) -> dict[str, str]:
    return {"id": str(user.id), "sub": user.sub, "email": user.email}
