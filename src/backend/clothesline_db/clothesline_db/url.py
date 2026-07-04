def adonet_to_asyncpg_url(conn_str: str) -> str:
    """Convert an Aspire/.NET-style `Key=Value;Key=Value` Postgres connection
    string into a `postgresql+asyncpg://` URL. Aspire's Postgres integration
    injects connection strings in this ADO.NET form (e.g.
    `Host=...;Port=...;Username=...;Password=...;Database=...`), not a URI."""
    parts = dict(item.split("=", 1) for item in conn_str.split(";") if item.strip() and "=" in item)
    lower = {k.strip().lower(): v.strip() for k, v in parts.items()}
    host = lower.get("host", "localhost")
    port = lower.get("port", "5432")
    user = lower.get("username", lower.get("user id", "postgres"))
    password = lower.get("password", "postgres")
    database = lower.get("database", "clothesline_db")
    return f"postgresql+asyncpg://{user}:{password}@{host}:{port}/{database}"
