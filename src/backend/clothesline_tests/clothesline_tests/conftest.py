import os
from collections.abc import AsyncIterator, Iterator
from pathlib import Path

import pytest
import pytest_asyncio
from alembic import command
from alembic.config import Config
from clothesline_db.models import Base
from clothesline_db.session import async_session_factory, create_db_engine
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from testcontainers.postgres import PostgresContainer

# Resolved from this file's own location, not the CWD pytest happens to be
# invoked from — CI and local devcontainer runs may differ.
_CLOTHESLINE_DB_ROOT = Path(__file__).resolve().parents[2] / "clothesline_db"


@pytest.fixture(scope="session")
def postgres_url() -> Iterator[str]:
    with PostgresContainer("postgres:16-alpine", driver="asyncpg") as pg:
        yield pg.get_connection_url()


@pytest.fixture(scope="session")
def migrated_engine(postgres_url: str) -> Iterator[AsyncEngine]:
    # alembic's command API is sync; it shells out to clothesline_db/migrations/
    # env.py, which runs its own async engine internally against the same URL.
    os.environ["CLOTHESLINE_DB_URL"] = postgres_url
    cfg = Config(str(_CLOTHESLINE_DB_ROOT / "alembic.ini"))
    migrations_dir = _CLOTHESLINE_DB_ROOT / "clothesline_db" / "migrations"
    cfg.set_main_option("script_location", str(migrations_dir))
    command.upgrade(cfg, "head")
    del os.environ["CLOTHESLINE_DB_URL"]

    engine = create_db_engine(postgres_url)
    yield engine


@pytest_asyncio.fixture
async def db_session(migrated_engine: AsyncEngine) -> AsyncIterator[AsyncSession]:
    session_factory = async_session_factory(migrated_engine)
    async with session_factory() as session:
        yield session
        await session.rollback()

    # truncate everything so each test starts from a clean slate without
    # paying container-startup cost per test
    async with migrated_engine.begin() as conn:
        table_names = ", ".join(f'"{t.name}"' for t in Base.metadata.sorted_tables)
        await conn.execute(text(f"TRUNCATE {table_names} RESTART IDENTITY CASCADE"))
