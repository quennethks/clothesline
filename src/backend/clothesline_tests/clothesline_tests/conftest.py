import datetime
import os
from collections.abc import AsyncIterator, Iterator
from dataclasses import dataclass
from pathlib import Path
from types import SimpleNamespace

import jwt
import pytest
import pytest_asyncio
from alembic import command
from alembic.config import Config
from clothesline_api.auth import jwks as jwks_module
from clothesline_api.auth.dependencies import get_current_user
from clothesline_api.common.deps import get_db_session
from clothesline_api.config import settings as api_settings
from clothesline_api.main import app
from clothesline_db.models import Base, User
from clothesline_db.session import async_session_factory, create_db_engine
from cryptography.hazmat.primitives.asymmetric import rsa
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from testcontainers.postgres import PostgresContainer

FAKE_ISSUER = "https://test-issuer.example.com"
FAKE_JWKS_URL = "https://test-issuer.example.com/jwks"
FAKE_KID = "test-kid"

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


@dataclass
class FakeJwks:
    """An in-process stand-in for Zitadel's JWKS endpoint (spec §10.1) — a
    real RSA keypair signs test tokens, and the API's JWKS client is
    monkeypatched to resolve them, so the real validation code path (PyJWT +
    issuer/expiry checks) runs unchanged against a fake key source."""

    private_key: rsa.RSAPrivateKey
    public_key: rsa.RSAPublicKey

    def make_token(self, claims: dict[str, object], *, kid: str | None = FAKE_KID) -> str:
        headers = {"kid": kid} if kid else {}
        return jwt.encode(claims, self.private_key, algorithm="RS256", headers=headers)


def sample_claims(**overrides: object) -> dict[str, object]:
    now = datetime.datetime.now(datetime.UTC)
    claims: dict[str, object] = {
        "sub": "zitadel|user-1",
        "email": "user@example.com",
        "iss": FAKE_ISSUER,
        "iat": now,
        "exp": now + datetime.timedelta(minutes=5),
    }
    claims.update(overrides)
    return claims


@pytest.fixture(scope="session")
def fake_jwks_keypair() -> FakeJwks:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    return FakeJwks(private_key=private_key, public_key=private_key.public_key())


@pytest.fixture
def fake_jwks(
    monkeypatch: pytest.MonkeyPatch, fake_jwks_keypair: FakeJwks
) -> Iterator[FakeJwks]:
    class _StubJwksClient:
        def get_signing_key_from_jwt(self, token: str) -> SimpleNamespace:
            return SimpleNamespace(key=fake_jwks_keypair.public_key)

    monkeypatch.setattr(jwks_module, "get_jwks_client", lambda url: _StubJwksClient())
    monkeypatch.setattr(api_settings, "oidc_issuer", FAKE_ISSUER)
    monkeypatch.setattr(api_settings, "oidc_jwks_url", FAKE_JWKS_URL)
    yield fake_jwks_keypair


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncIterator[AsyncClient]:
    async def _override_get_db_session() -> AsyncIterator[AsyncSession]:
        yield db_session

    app.dependency_overrides[get_db_session] = _override_get_db_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.pop(get_db_session, None)


PLACEHOLDER_TS = "2026-01-01T00:00:00.000Z"


def load_doc(load_id: str, user_id: object, **overrides: object) -> dict[str, object]:
    """A full loads wire doc for sync push tests. created_at/updated_at are
    placeholders the server ignores (it authors its own, spec §4) — only
    included because RxDB always pushes the full local document."""
    doc: dict[str, object] = {
        "id": load_id,
        "user_id": str(user_id),
        "name": "test-load",
        "shop_name": None,
        "shop_location": None,
        "send_date": None,
        "status": "draft",
        "total_sent": 0,
        "total_received": None,
        "reconciled": False,
        "created_at": PLACEHOLDER_TS,
        "updated_at": PLACEHOLDER_TS,
        "_deleted": False,
    }
    doc.update(overrides)
    return doc


async def push_create(
    client: AsyncClient, collection: str, doc: dict[str, object]
) -> list[dict[str, object]]:
    resp = await client.post(
        f"/sync/{collection}", json=[{"new_document_state": doc, "assumed_master_state": None}]
    )
    assert resp.status_code == 200
    return resp.json()  # type: ignore[no-any-return]


async def push_update(
    client: AsyncClient,
    collection: str,
    new_state: dict[str, object],
    assumed_master_state: dict[str, object],
) -> list[dict[str, object]]:
    resp = await client.post(
        f"/sync/{collection}",
        json=[{"new_document_state": new_state, "assumed_master_state": assumed_master_state}],
    )
    assert resp.status_code == 200
    return resp.json()  # type: ignore[no-any-return]


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession) -> User:
    user = User(sub="zitadel|sync-test-user", email="sync-test@example.com")
    db_session.add(user)
    await db_session.commit()
    return user


@pytest_asyncio.fixture
async def authed_client(client: AsyncClient, test_user: User) -> AsyncIterator[AsyncClient]:
    # Most sync tests bypass real JWT mechanics for speed (spec §10.1) —
    # test_sync_requires_auth.py is the one test exercising the real
    # get_current_user dependency end-to-end via the `client`/`fake_jwks`
    # fixtures instead of this override.
    app.dependency_overrides[get_current_user] = lambda: test_user
    yield client
    app.dependency_overrides.pop(get_current_user, None)
