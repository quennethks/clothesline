import jwt
from clothesline_db.models import User
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from clothesline_api.auth.jwks import decode_access_token
from clothesline_api.common.deps import get_db_session
from clothesline_api.config import settings
from clothesline_api.domain.users import upsert_user

_UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid or missing bearer token",
    headers={"WWW-Authenticate": "Bearer"},
)


def _extract_bearer_token(request: Request) -> str:
    header = request.headers.get("Authorization")
    if not header or not header.startswith("Bearer "):
        raise _UNAUTHORIZED
    return header.removeprefix("Bearer ").strip()


async def get_current_user(
    request: Request, session: AsyncSession = Depends(get_db_session)
) -> User:
    token = _extract_bearer_token(request)
    try:
        claims = decode_access_token(
            token, issuer=settings.oidc_issuer, jwks_url=settings.oidc_jwks_url
        )
    except jwt.PyJWTError as exc:
        raise _UNAUTHORIZED from exc

    sub = claims.get("sub")
    email = claims.get("email")
    if not isinstance(sub, str) or not isinstance(email, str):
        raise _UNAUTHORIZED

    return await upsert_user(session, sub=sub, email=email)
