from urllib.parse import quote_plus

# ADO.NET spells this several ways; Postgres/libpq spells it `sslmode`.
_SSL_MODE_KEYS = ("ssl mode", "sslmode")

# asyncpg does NOT understand libpq's `sslmode=` — it takes an `ssl=` argument
# whose accepted values happen to be the same words. SQLAlchemy's asyncpg dialect
# forwards `ssl` from the URL query string, so `?ssl=require` is the way through.
# (Passing `?sslmode=require` silently reaches asyncpg.connect() as an unexpected
# keyword and raises at connect time.)
_SSL_QUERY_KEY = "ssl"


def adonet_to_asyncpg_url(conn_str: str, ssl_mode: str | None = None) -> str:
    """Convert an Aspire/.NET-style `Key=Value;Key=Value` Postgres connection
    string into a `postgresql+asyncpg://` URL. Aspire's Postgres integration
    injects connection strings in this ADO.NET form (e.g.
    `Host=...;Port=...;Username=...;Password=...;Database=...`), not a URI.

    `ssl_mode` (or an `Ssl Mode` key in the string) is carried across as
    asyncpg's `?ssl=`. Azure Database for PostgreSQL Flexible Server enforces TLS
    (spec §5.6b) while the local container has it disabled entirely — and Aspire
    does not put an SSL mode in the connection string it generates, so the caller
    has to supply it.
    """
    parts = dict(item.split("=", 1) for item in conn_str.split(";") if item.strip() and "=" in item)
    lower = {k.strip().lower(): v.strip() for k, v in parts.items()}
    host = lower.get("host", "localhost")
    port = lower.get("port", "5432")
    user = lower.get("username", lower.get("user id", "postgres"))
    password = lower.get("password", "postgres")
    database = lower.get("database", "clothesline_db")

    # Passwords are generated and can contain URL-significant characters.
    url = f"postgresql+asyncpg://{quote_plus(user)}:{quote_plus(password)}@{host}:{port}/{database}"

    resolved_ssl = ssl_mode or next((lower[key] for key in _SSL_MODE_KEYS if key in lower), None)
    if resolved_ssl:
        url = f"{url}?{_SSL_QUERY_KEY}={quote_plus(resolved_ssl.lower())}"

    return url
