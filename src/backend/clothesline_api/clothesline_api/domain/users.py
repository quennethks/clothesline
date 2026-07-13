from clothesline_db.models import User
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


async def get_user_by_sub(session: AsyncSession, *, sub: str) -> User | None:
    return (await session.execute(select(User).where(User.sub == sub))).scalar_one_or_none()


async def upsert_user(session: AsyncSession, *, sub: str, email: str) -> User:
    """First authenticated request creates the local User mirror; later
    requests refresh `email` in place so it can't drift from the identity
    provider's record (spec §5.5)."""
    existing = await get_user_by_sub(session, sub=sub)
    if existing is not None:
        if existing.email != email:
            existing.email = email
            await session.commit()
        return existing

    user = User(sub=sub, email=email)
    session.add(user)
    await session.commit()
    return user
