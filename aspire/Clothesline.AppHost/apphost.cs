#:package Aspire.Hosting.Azure.Storage@13.4.6
#:package Aspire.Hosting.JavaScript@13.4.6
#:package Aspire.Hosting.PostgreSQL@13.4.6
#:package Aspire.Hosting.Python@13.4.6
#:package CommunityToolkit.Aspire.Hosting.Mailpit@13.4.0
#:sdk Aspire.AppHost.Sdk@13.4.6

using Aspire.Hosting;
using Aspire.Hosting.ApplicationModel;

var builder = DistributedApplication.CreateBuilder(args);

// --- secrets / parameters ---
// The plain AddParameter(name, secret: true) overload has no default value —
// it waits for an interactive prompt (or a previously persisted value), which
// hangs forever under `--non-interactive` on a first run. AddParameter(name,
// new GenerateParameterDefault(), secret: true, persist: true) auto-generates
// a value and persists it, so it doesn't rotate on every `aspire run`.
var zitadelMasterkey = builder.AddParameter(
    "zitadel-masterkey",
    new GenerateParameterDefault { MinLength = 32, Special = false }, // Zitadel requires exactly a 32-byte masterkey
    secret: true,
    persist: true);

// --- data ---
// UserNameParameter/PasswordParameter are only populated on the resource when
// explicitly supplied here — otherwise they're null (NullReferenceException
// if referenced later), so we create them ourselves to feed Zitadel's env vars.
var pgUser = builder.AddParameter("pg-username", value: "postgres");
var pgPassword = builder.AddParameter("pg-password", new GenerateParameterDefault(), secret: true, persist: true);
var pg = builder.AddPostgres("pg", pgUser, pgPassword);
var appDb = pg.AddDatabase("clothesline-db", databaseName: "clothesline_db");
var zitadelDb = pg.AddDatabase("zitadel-db", databaseName: "zitadel");

var storage = builder.AddAzureStorage("storage").RunAsEmulator();
var blobs = storage.AddBlobs("blobs");

// --- identity infra ---
var mailpit = builder.AddMailPit("mailpit");

// Fixed ports for web/zitadel/login-v2: OIDC redirect URIs and CORS origins
// need to stay stable across `aspire run` restarts (Aspire's dynamic proxy
// ports change every run otherwise).
const int zitadelPort = 8080;
const int loginV2Port = 3000;
const int webPort = 5173;
const int apiPort = 8000;

var browserFacingIssuer = $"http://localhost:{zitadelPort}";
var internalJwksUrl = $"http://zitadel:{zitadelPort}/oauth/v2/keys";

// The Zitadel image runs as a non-root user, so the shared named volume
// (Docker-created, root-owned by default) needs to be world-writable before
// Zitadel can write the Login V2 PAT into it. A tiny init container that
// exits 0 after chmod-ing the volume, gated with WaitForCompletion, is the
// idiomatic Aspire way to sequence this ahead of the real containers.
var machinekeyInit = builder.AddContainer("zitadel-machinekey-init", "alpine", "latest")
    .WithArgs("chmod", "777", "/machinekey")
    .WithVolume("zitadel-machinekeys", "/machinekey");

var zitadel = builder.AddContainer("zitadel", "ghcr.io/zitadel/zitadel", "v4.15.3")
    .WithArgs(
        "start-from-init",
        "--masterkeyFromEnv",
        "--tlsMode", "disabled",
        "--steps", "/init-steps.yaml"
    )
    .WithHttpEndpoint(port: zitadelPort, targetPort: zitadelPort, name: "http")
    .WithEnvironment("ZITADEL_MASTERKEY", zitadelMasterkey)
    .WithEnvironment("ZITADEL_EXTERNALSECURE", "false")
    .WithEnvironment("ZITADEL_EXTERNALDOMAIN", "localhost")
    .WithEnvironment("ZITADEL_EXTERNALPORT", zitadelPort.ToString())
    .WithEnvironment("ZITADEL_DEFAULTINSTANCE_FEATURES_LOGINV2_REQUIRED", "true")
    .WithEnvironment("ZITADEL_DATABASE_POSTGRES_HOST", $"{pg.Resource.Host}")
    .WithEnvironment("ZITADEL_DATABASE_POSTGRES_PORT", $"{pg.Resource.Port}")
    .WithEnvironment("ZITADEL_DATABASE_POSTGRES_DATABASE", zitadelDb.Resource.DatabaseName)
    .WithEnvironment("ZITADEL_DATABASE_POSTGRES_USER_USERNAME", $"{pg.Resource.UserNameParameter}")
    .WithEnvironment("ZITADEL_DATABASE_POSTGRES_USER_PASSWORD", $"{pg.Resource.PasswordParameter}")
    .WithEnvironment("ZITADEL_DATABASE_POSTGRES_USER_SSL_MODE", "disable")
    .WithEnvironment("ZITADEL_DATABASE_POSTGRES_ADMIN_USERNAME", $"{pg.Resource.UserNameParameter}")
    .WithEnvironment("ZITADEL_DATABASE_POSTGRES_ADMIN_PASSWORD", $"{pg.Resource.PasswordParameter}")
    .WithEnvironment("ZITADEL_DATABASE_POSTGRES_ADMIN_SSL_MODE", "disable")
    .WithEnvironment("ZITADEL_SMTP_HOST", $"{mailpit.Resource.Host}")
    .WithEnvironment("ZITADEL_SMTP_PORT", $"{mailpit.Resource.Port}")
    .WithEnvironment("ZITADEL_SMTP_TLS", "false")
    .WithEnvironment("ZITADEL_FIRSTINSTANCE_LOGINCLIENTPATPATH", "/machinekey/login-client.pat")
    .WithEnvironment("ZITADEL_FIRSTINSTANCE_PATPATH", "/machinekey/admin.pat")
    .WithBindMount("../../ops/zitadel/init-steps.yaml", "/init-steps.yaml", isReadOnly: true)
    .WithVolume("zitadel-machinekeys", "/machinekey")
    .WithHttpHealthCheck(path: "/debug/healthz", endpointName: "http")
    .WaitFor(zitadelDb)
    .WaitForCompletion(machinekeyInit);

var loginV2 = builder.AddContainer("login-v2", "ghcr.io/zitadel/zitadel-login", "v4.7.3")
    .WithHttpEndpoint(port: loginV2Port, targetPort: loginV2Port, name: "http")
    .WithEnvironment("ZITADEL_API_URL", $"{zitadel.GetEndpoint("http")}")
    .WithEnvironment("ZITADEL_SERVICE_USER_TOKEN_FILE", "/machinekey/login-client.pat")
    .WithVolume("zitadel-machinekeys", "/machinekey")
    .WaitFor(zitadel);

// Zitadel's declarative FirstInstance bootstrap (init-steps.yaml) has no
// Projects/OIDCApps section — an OIDC application's client_id is only
// obtainable by calling the Management API, and the id is generated by
// Zitadel itself so it can't be known at graph-build time. A one-shot
// container calls the API (using the IAM_OWNER admin PAT bootstrapped
// alongside login-client, above) and writes the resulting client_id to a
// host-visible bind mount; `web`'s environment is populated by reading that
// file lazily (a plain Func<string>, evaluated only once WaitForCompletion
// below is satisfied), since the id doesn't exist yet when this file is
// first evaluated.
var oidcClientOutputDir = Path.Combine(builder.AppHostDirectory, "..", "..", ".aspire-out");
Directory.CreateDirectory(oidcClientOutputDir);
var oidcClientIdFile = Path.Combine(oidcClientOutputDir, "client_id.txt");

var webRedirectUri = $"http://localhost:{webPort}/auth/callback";
var webPostLogoutRedirectUri = $"http://localhost:{webPort}";
var zitadelExternalHost = $"localhost:{zitadelPort}";

var oidcBootstrap = builder.AddContainer("zitadel-oidc-bootstrap", "python", "3.12-slim")
    .WithEntrypoint("sh")
    .WithArgs("-c", "pip install --quiet httpx && python /bootstrap/bootstrap_oidc_app.py")
    .WithEnvironment("ZITADEL_API_URL", $"{zitadel.GetEndpoint("http")}")
    // Zitadel resolves its instance by the request's Host header (matching
    // ExternalDomain/ExternalPort=localhost:8080), not by the connection
    // address — the container-network hostname above doesn't match, so every
    // Management API call 404s ("instance not found") unless this is forced.
    .WithEnvironment("ZITADEL_EXTERNAL_HOST", zitadelExternalHost)
    .WithEnvironment("ADMIN_PAT_PATH", "/machinekey/admin.pat")
    .WithEnvironment("CLIENT_ID_OUTPUT_PATH", "/output/client_id.txt")
    .WithEnvironment("REDIRECT_URI", webRedirectUri)
    .WithEnvironment("POST_LOGOUT_REDIRECT_URI", webPostLogoutRedirectUri)
    .WithBindMount("../../ops/zitadel/bootstrap_oidc_app.py", "/bootstrap/bootstrap_oidc_app.py", isReadOnly: true)
    .WithVolume("zitadel-machinekeys", "/machinekey")
    .WithBindMount(oidcClientOutputDir, "/output")
    .WaitFor(zitadel);

// --- database migrations ---
// One-shot `alembic upgrade head` (spec §2.1's `mig` node) — gated on
// Postgres, and the API in turn waits for this to finish before it starts, so
// the schema always exists first. Working directory is the clothesline_db
// package itself (not the workspace root) because alembic.ini's
// `script_location = clothesline_db/migrations` is resolved relative to the
// process's CWD, not the ini file's own location (verified empirically) —
// `uv run` still auto-discovers the shared workspace .venv from this
// subdirectory.
var migrate = builder.AddExecutable(
        "clothesline-db-migrate", "uv", "../../src/backend/clothesline_db",
        "run", "alembic", "-c", "alembic.ini", "upgrade", "head")
    .WithEnvironment("ConnectionStrings__clothesline_db", appDb.Resource.ConnectionStringExpression)
    .WaitFor(appDb);

// --- app services ---
// appDirectory is the uv *workspace root* (src/backend), not the
// clothesline_api subpackage — `uv sync` for a workspace member creates the
// one shared .venv at the workspace root, so that's where .venv/bin/uvicorn
// actually ends up.
var api = builder.AddUvicornApp("clothesline-api", "../../src/backend", "clothesline_api.main:app")
    .WithUv()
    .WaitForCompletion(migrate)
    // isProxied: false — non-container (executable) resources can't be
    // proxied when Port == TargetPort; we want a fixed, predictable port so
    // isProxied is disabled instead of letting Port/TargetPort diverge.
    // HTTPS, not HTTP — AddUvicornApp always launches uvicorn with an
    // auto-generated dev cert (--ssl-keyfile/--ssl-certfile) regardless of
    // the endpoint type declared here, so the endpoint must be Https or every
    // GetEndpoint("...")-derived URL for this resource emits the wrong scheme.
    .WithHttpsEndpoint(port: apiPort, targetPort: apiPort, env: "PORT", isProxied: false)
    .WithArgs("--host", "0.0.0.0", "--port", apiPort.ToString())
    .WithReference(appDb)
    .WithEnvironment("ConnectionStrings__clothesline_db", appDb.Resource.ConnectionStringExpression)
    .WithReference(blobs)
    // Browser-facing issuer (host-reachable) vs. internal JWKS fetch URL
    // (container-network hostname) are deliberately different — JWT
    // libraries validate `iss` and fetch `jwks_uri` independently.
    .WithEnvironment("OIDC_ISSUER", browserFacingIssuer)
    .WithEnvironment("OIDC_JWKS_URL", internalJwksUrl)
    .WaitFor(appDb);

var web = builder.AddViteApp("clothesline-web", "../../src/frontend/clothesline-web")
    .WithHttpEndpoint(port: webPort, targetPort: webPort, env: "PORT", isProxied: false)
    .WithReference(api)
    .WaitForCompletion(oidcBootstrap)
    .WithEnvironment("VITE_API_BASE_URL", $"{api.GetEndpoint("https")}")
    .WithEnvironment("VITE_OIDC_ISSUER", browserFacingIssuer)
    .WithEnvironment("VITE_LOGIN_V2_URL", $"{loginV2.GetEndpoint("http")}")
    .WithEnvironment("VITE_OIDC_CLIENT_ID", () => File.ReadAllText(oidcClientIdFile).Trim());

api.WithEnvironment("ALLOWED_ORIGINS", $"{web.GetEndpoint("http")}");

builder.Build().Run();
