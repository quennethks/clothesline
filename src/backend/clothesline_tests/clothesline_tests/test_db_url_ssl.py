"""The ADO.NET → asyncpg connection-string translation.

The SSL cases matter because Azure Database for PostgreSQL Flexible Server
enforces TLS while the local Postgres container has it disabled entirely
(spec §5.6b) — and because asyncpg does not understand libpq's `sslmode=`,
so a naive pass-through silently fails at connect time.
"""

from clothesline_db.url import adonet_to_asyncpg_url


def test_local_connection_string_has_no_ssl_query() -> None:
    url = adonet_to_asyncpg_url(
        "Host=localhost;Port=5432;Username=postgres;Password=pw;Database=clothesline_db"
    )
    assert url == "postgresql+asyncpg://postgres:pw@localhost:5432/clothesline_db"
    assert "ssl" not in url


def test_ssl_mode_becomes_asyncpg_ssl_query() -> None:
    url = adonet_to_asyncpg_url(
        "Host=pg.postgres.database.azure.com;Username=postgres;Password=pw;"
        "Database=clothesline_db;Ssl Mode=Require"
    )
    # asyncpg takes `ssl=`, NOT libpq's `sslmode=` — passing the latter reaches
    # asyncpg.connect() as an unexpected keyword argument and raises.
    assert url.endswith("?ssl=require")
    assert "sslmode" not in url


def test_ssl_mode_spelling_without_space_is_accepted() -> None:
    url = adonet_to_asyncpg_url("Host=h;Username=u;Password=p;Database=d;SslMode=Require")
    assert url.endswith("?ssl=require")


def test_password_with_url_significant_characters_is_escaped() -> None:
    # Aspire generates these, so they can contain anything.
    url = adonet_to_asyncpg_url("Host=h;Username=u;Password=p@ss:w/rd;Database=d")
    assert "p%40ss%3Aw%2Frd" in url
    assert "p@ss:w/rd" not in url
