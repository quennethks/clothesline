from clothesline_db.models import User
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


async def upsert_user(session: AsyncSession, *, sub: str, email: str) -> User:
    """First authenticated request creates the local User mirror; later
    requests refresh `email` in place so it can't drift from the identity
    provider's record (spec §5.5)."""
    existing = (await session.execute(select(User).where(User.sub == sub))).scalar_one_or_none()
    if existing is not None:
        if existing.email != email:
            existing.email = email
            await session.commit()
        return existing

    user = User(sub=sub, email=email)
    session.add(user)
    await session.commit()
    return user
