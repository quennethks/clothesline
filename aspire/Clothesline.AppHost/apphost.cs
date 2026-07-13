#:package Aspire.Hosting.Azure.AppContainers@13.4.6
#:package Aspire.Hosting.Azure.KeyVault@13.4.6
#:package Aspire.Hosting.Azure.PostgreSQL@13.4.6
#:package Aspire.Hosting.Azure.Storage@13.4.6
#:package Aspire.Hosting.JavaScript@13.4.6
#:package Aspire.Hosting.PostgreSQL@13.4.6
#:package Aspire.Hosting.Python@13.4.6
#:package CommunityToolkit.Aspire.Hosting.Mailpit@13.4.0
#:sdk Aspire.AppHost.Sdk@13.4.6

using Aspire.Hosting;
using Aspire.Hosting.ApplicationModel;
using Aspire.Hosting.ApplicationModel.Docker;
using Aspire.Hosting.Azure;
using Aspire.Hosting.Pipelines;
using Azure.Provisioning.AppContainers;
using Azure.Provisioning;
using Azure.Provisioning.Expressions;
using Azure.Provisioning.KeyVault;
using Azure.Provisioning.Storage;
// Aliased: Azure.Provisioning.Storage.FileShare collides with System.IO.FileShare.
using AzureFileShare = Azure.Provisioning.Storage.FileShare;

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

// The two modes need genuinely different topologies, so this is the one place
// the graph forks (spec §2.1 vs §2.2):
//
//   run     — ONE Postgres container hosting two databases. Simplest thing that
//             boots; the local graph is disposable and re-bootstrapped each run.
//   publish — TWO Azure Database for PostgreSQL Flexible Servers, identity vs.
//             app, with independent credentials and backups. Spec §11.6 is
//             explicit that these stay split even if the two ACA environments
//             are ever collapsed into one — an IdP's user store and the app's
//             data should not share a blast radius.
//
// This fork is also what makes the deployment durable: a Postgres *container*
// in ACA has an ephemeral filesystem, so every revision would silently destroy
// Zitadel's user database. A Flexible Server is a managed resource with its own
// lifecycle, untouched by container revisions.
IResourceBuilder<IResourceWithConnectionString> appDb;
IResourceBuilder<IResourceWithConnectionString> zitadelDb;

// Zitadel takes discrete ZITADEL_DATABASE_POSTGRES_HOST/PORT/... env vars — it
// has no connection-string form — so each mode has to surface these separately.
ReferenceExpression zitadelDbHost;
ReferenceExpression zitadelDbPort;

if (builder.ExecutionContext.IsRunMode)
{
    var pg = builder.AddPostgres("pg", pgUser, pgPassword);
    appDb = pg.AddDatabase("clothesline-db", databaseName: "clothesline_db");
    zitadelDb = pg.AddDatabase("zitadel-db", databaseName: "zitadel");

    // Interpolate the resource properties DIRECTLY — do not call .ToString() on
    // them. Port is an EndpointReferenceExpression, not an int, so ToString()
    // yields the literal text "Aspire.Hosting.ApplicationModel.EndpointReference-
    // Expression" and Zitadel dies with `cannot parse 'Port' as int`. Passing the
    // object lets ReferenceExpression's interpolation handler resolve it lazily.
    // (Same class of bug as the JWKS URL note further down.)
    zitadelDbHost = ReferenceExpression.Create($"{pg.Resource.Host}");
    zitadelDbPort = ReferenceExpression.Create($"{pg.Resource.Port}");
}
else
{
    // Password auth, not Entra: Zitadel has no notion of Azure managed identity
    // and authenticates to Postgres with a username/password pair. The app DB
    // uses the same for symmetry (asyncpg would need extra plumbing for Entra
    // tokens, and the API's driver is asyncpg).
    var pgApp = builder.AddAzurePostgresFlexibleServer("pg-app")
        .WithPasswordAuthentication(pgUser, pgPassword);
    var pgIdentity = builder.AddAzurePostgresFlexibleServer("pg-identity")
        .WithPasswordAuthentication(pgUser, pgPassword);

    appDb = pgApp.AddDatabase("clothesline-db", databaseName: "clothesline_db");
    zitadelDb = pgIdentity.AddDatabase("zitadel-db", databaseName: "zitadel");

    zitadelDbHost = ReferenceExpression.Create($"{pgIdentity.Resource.HostName}");
    zitadelDbPort = ReferenceExpression.Create($"5432");
}

// Fixed blob port for the same reason web/zitadel get fixed ports: the
// browser PUTs/GETs photo bytes *directly* to Blob via SAS URLs (spec §8.2),
// so Azurite's origin has to be stable and reachable from the browser — a
// dynamic Aspire proxy port isn't (see BLOB_PUBLIC_ORIGIN on the API below).
const int blobPort = 10000;
var storage = builder.AddAzureStorage("storage")
    .RunAsEmulator(emulator => emulator.WithBlobPort(blobPort));
var blobs = storage.AddBlobs("blobs");

// --- identity infra ---
// Fixed ports for web/zitadel/login-v2: OIDC redirect URIs and CORS origins
// need to stay stable across `aspire run` restarts (Aspire's dynamic proxy
// ports change every run otherwise).
const int zitadelPort = 8080;
const int loginV2Port = 3000;
const int webPort = 5173;
const int apiPort = 8000;

var isPublish = builder.ExecutionContext.IsPublishMode;

// The identity origin has to be final BEFORE Zitadel's first boot: it bakes
// ExternalDomain into token issuers and session cookies, so changing it later
// invalidates every token and session even though the rows survive (spec §5.6b).
// The ACA-generated FQDN isn't known until after provisioning, hence a required
// parameter rather than a derived value — see ops/DEPLOY.md.
//
// Supplied non-interactively as the env var `Parameters__identity-domain` —
// Aspire resolves parameters from the `Parameters:` configuration section. (There
// is no ASPIRE_PARAMETER_* convention; that form is silently ignored and the
// deploy then blocks on a prompt.)
var identityDomain = isPublish
    ? builder.AddParameter("identity-domain")
    : null;

// Binding the identity domain takes THREE passes, and each one is gated by one of
// the two parameters below. Azure's constraints chain, and there is no way to
// collapse them (ops/DEPLOY.md §3):
//
//   pass 1  bind=false, cert=""      no custom domain. The app comes up on its
//                                    generated FQDN — which is the value the CNAME
//                                    needs, alongside a verification id that does
//                                    not exist until the app does. Attaching the
//                                    domain here is impossible: Azure validates
//                                    ownership even for a Disabled binding, and the
//                                    DNS records cannot exist yet.
//   pass 2  bind=true,  cert=""      DNS now points at the app, so the hostname
//                                    attaches (binding Disabled). Azure refuses to
//                                    issue a managed certificate for a hostname that
//                                    is not already attached to an app in the
//                                    environment — RequireCustomHostnameInEnvironment
//                                    — so this pass is what makes the certificate
//                                    creatable at all.
//   pass 3  bind=true,  cert=<name>  the certificate exists; the binding flips to
//                                    SniEnabled and the domain serves HTTPS.
//
// Both default to off so a first deploy into a fresh environment just works.
var bindIdentityDomain =
    (builder.Configuration["Parameters:bind-identity-domain"] ?? "false")
        .Equals("true", StringComparison.OrdinalIgnoreCase);
var certificateNameValue = builder.Configuration["Parameters:certificate-name"] ?? "";
var certificateName = isPublish
    ? builder.AddParameter("certificate-name", value: certificateNameValue)
    : null;

// Under GitHub Codespaces, each port is forwarded to its own HTTPS subdomain
// (https://{CODESPACE_NAME}-{port}.{domain}) rather than being reachable as
// localhost from the browser — anything baked into the OIDC issuer/redirect
// URIs has to follow suit there, or the browser's fetches to "localhost"
// resolve to the developer's own machine instead of the Codespace.
var isCodespaces = Environment.GetEnvironmentVariable("CODESPACES") == "true";
var codespaceName = Environment.GetEnvironmentVariable("CODESPACE_NAME");
var codespacePortForwardingDomain = Environment.GetEnvironmentVariable("GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN");

// Codespaces forwarded URLs are always HTTPS regardless of the backing
// service's own scheme (its TLS is terminated at GitHub's edge), so
// localScheme only applies to the non-Codespaces localhost fallback.
//
// NOTE: this helper is for RUN MODE ONLY. In publish mode there are no fixed
// ports and no localhost — every externally-visible URL is derived from
// identityDomain or from an ACA endpoint instead. Calling it under publish is
// what used to bake "http://localhost:8080" into the deployed container apps.
string PublicUrl(int port, string localScheme = "http") => isCodespaces
    ? $"https://{codespaceName}-{port}.{codespacePortForwardingDomain}"
    : $"{localScheme}://localhost:{port}";

// The single-origin identity URL the *browser* sees (Zitadel core + Login V2
// behind identity-proxy). In publish mode this is the custom domain; Zitadel
// stamps it into token issuers, so the API validates `iss` against it too.
var browserFacingIssuer = isPublish
    ? ReferenceExpression.Create($"https://{identityDomain!}")
    : ReferenceExpression.Create($"{PublicUrl(zitadelPort)}");

// Host header Zitadel resolves its instance by (must equal ExternalDomain, plus
// ExternalPort when it isn't the scheme default — 443 in publish, so bare).
var zitadelExternalHost = isPublish
    ? ReferenceExpression.Create($"{identityDomain!}")
    : ReferenceExpression.Create($"{(isCodespaces ? $"{codespaceName}-{zitadelPort}.{codespacePortForwardingDomain}" : $"localhost:{zitadelPort}")}");

// The header that carries that value in Azure, where Host belongs to ACA's
// ingress and cannot also be used to select the Zitadel instance. See the
// ZITADEL_HTTP1HOSTHEADER note on the zitadel resource below.
const string zitadelHostHeader = "x-zitadel-forward-host";

// Mailpit is the local OTP/verification mail sink (spec §10.3) — the e2e suite
// reads Zitadel's mail out of its HTTP API. Production email is DEFERRED: no
// SMTP is configured in Azure, so Zitadel will not send verification/recovery
// mail there. Sign-in itself (email + password, spec §5.5) is unaffected.
const int mailpitPort = 8025;
IResourceBuilder<MailPitContainerResource>? mailpit = builder.ExecutionContext.IsRunMode
    ? builder.AddMailPit("mailpit").WithEndpoint("http", endpoint => endpoint.Port = mailpitPort)
    : null;

// The Zitadel image runs as a non-root user, so the shared named volume
// (Docker-created, root-owned by default) needs to be world-writable before
// Zitadel can write the Login V2 PAT into it. A tiny init container that
// exits 0 after chmod-ing the volume, gated with WaitForCompletion, is the
// idiomatic Aspire way to sequence this ahead of the real containers.
//
// RUN MODE ONLY — see the WaitForCompletion below for why this must not be
// published: in Azure the volume is an Azure Files (SMB) share, where a chmod
// fails outright and would deadlock the deploy.
var machinekeyInit = builder.ExecutionContext.IsRunMode
    ? builder.AddContainer("zitadel-machinekey-init", "alpine", "latest")
        .WithArgs("chmod", "777", "/machinekey")
        .WithVolume("zitadel-machinekeys", "/machinekey")
    : null;

// Azure Postgres Flexible Server enforces TLS; the local container doesn't have
// it enabled at all, so this can't be a single constant (spec §5.6b).
var zitadelDbSslMode = isPublish ? "require" : "disable";

// Aspire's Postgres connection string carries no SSL mode, and in publish mode
// it reaches the API as a Key Vault *secret reference* — an opaque handle we
// can't append to. So the requirement travels as its own env var, which
// clothesline_db/url.py folds into asyncpg's `?ssl=` (asyncpg does not accept
// libpq's `sslmode=`). Empty locally, where Postgres has no TLS at all.
var dbSslMode = isPublish ? "require" : "";

// Built from ops/zitadel/Dockerfile (Zitadel + init-steps.yaml baked in) rather
// than the bare upstream image — see that file for why the bind mount had to go.
var zitadel = builder.AddDockerfile("zitadel", "../../ops/zitadel")
    .WithArgs(
        "start-from-init",
        "--masterkeyFromEnv",
        // TLS is terminated ahead of Zitadel in both modes — by identity-proxy
        // locally, by ACA's ingress in Azure — so Zitadel itself always serves
        // cleartext and is told about the external scheme via ExternalSecure.
        "--tlsMode", "disabled",
        "--steps", "/init-steps.yaml"
    )
    // No fixed host port — only identity-proxy (declared below) is exposed on
    // zitadelPort; other containers reach this one via its container-network
    // endpoint (zitadel.dev.internal:{zitadelPort}) instead.
    .WithHttpEndpoint(targetPort: zitadelPort, name: "http")
    .WithEnvironment("ZITADEL_MASTERKEY", zitadelMasterkey)
    // ExternalSecure/Domain/Port describe how the *browser* reaches Zitadel, not
    // how Zitadel listens. In Azure that's HTTPS on the custom domain at 443;
    // these three must agree with identity-proxy's forwarded proto/host below or
    // Zitadel resolves the wrong instance and 404s every request.
    .WithEnvironment("ZITADEL_EXTERNALSECURE", (isPublish || isCodespaces) ? "true" : "false")
    .WithEnvironment("ZITADEL_EXTERNALDOMAIN", isPublish
        ? ReferenceExpression.Create($"{identityDomain!}")
        : ReferenceExpression.Create($"{(isCodespaces ? $"{codespaceName}-{zitadelPort}.{codespacePortForwardingDomain}" : "localhost")}"))
    .WithEnvironment("ZITADEL_EXTERNALPORT", (isPublish || isCodespaces) ? "443" : zitadelPort.ToString())
    .WithEnvironment("ZITADEL_DEFAULTINSTANCE_FEATURES_LOGINV2_REQUIRED", "true")
    // Defaults to the *relative* path "/ui/v2/login/login?authRequest=", which
    // only works if Login V2 shares Zitadel core's origin. identity-proxy
    // (below) makes that true via path routing under browserFacingIssuer —
    // kept explicit here (rather than relying on the bare default) since it
    // documents the single-origin design directly.
    .WithEnvironment("ZITADEL_OIDC_DEFAULTLOGINURLV2", ReferenceExpression.Create($"{browserFacingIssuer}/ui/v2/login/login?authRequest="))
    .WithEnvironment("ZITADEL_OIDC_DEFAULTLOGOUTURLV2", ReferenceExpression.Create($"{browserFacingIssuer}/ui/v2/login/logout?post_logout_redirect="))
    // Zitadel takes discrete connection settings, not a connection string, so
    // these are resolved from whichever Postgres the mode branch selected.
    .WithEnvironment("ZITADEL_DATABASE_POSTGRES_HOST", zitadelDbHost)
    .WithEnvironment("ZITADEL_DATABASE_POSTGRES_PORT", zitadelDbPort)
    .WithEnvironment("ZITADEL_DATABASE_POSTGRES_DATABASE", zitadelDb.Resource.Name)
    .WithEnvironment("ZITADEL_DATABASE_POSTGRES_USER_USERNAME", pgUser)
    .WithEnvironment("ZITADEL_DATABASE_POSTGRES_USER_PASSWORD", pgPassword)
    .WithEnvironment("ZITADEL_DATABASE_POSTGRES_USER_SSL_MODE", zitadelDbSslMode)
    .WithEnvironment("ZITADEL_DATABASE_POSTGRES_ADMIN_USERNAME", pgUser)
    .WithEnvironment("ZITADEL_DATABASE_POSTGRES_ADMIN_PASSWORD", pgPassword)
    .WithEnvironment("ZITADEL_DATABASE_POSTGRES_ADMIN_SSL_MODE", zitadelDbSslMode)
    .WithEnvironment("ZITADEL_FIRSTINSTANCE_LOGINCLIENTPATPATH", "/machinekey/login-client.pat")
    .WithEnvironment("ZITADEL_FIRSTINSTANCE_PATPATH", "/machinekey/admin.pat")
    // Identify the machine by HOSTNAME, not by private IP.
    //
    // Zitadel mints ids with Sonyflake, which needs a unique machine id and by
    // default derives one from the container's private IP. That lookup finds no
    // usable address on ACA and Zitadel PANICS on boot — "none of the enabled
    // methods for identifying the machine succeeded" (internal/id/sonyflake.go).
    //
    // It panics *after* recording the migration as started, so the pod dies holding
    // the lock, and every replacement pod then waits forever on a migration nobody
    // is running ("migration already started, will check again in 5 seconds").
    // The IdP never serves and never writes its admin PAT, so Login V2 and the OIDC
    // bootstrap job hang too. The whole identity environment fails from this one
    // default. The container's hostname is unique per replica, which is all
    // Sonyflake actually needs.
    .WithEnvironment("ZITADEL_MACHINE_IDENTIFICATION_PRIVATEIP_ENABLED", "false")
    .WithEnvironment("ZITADEL_MACHINE_IDENTIFICATION_HOSTNAME_ENABLED", "true")
    // In Azure, resolve the instance from a CUSTOM HEADER rather than Host.
    //
    // Zitadel picks the instance by matching the request's Host against
    // ExternalDomain. That is unworkable inside ACA, because ACA's ingress *also*
    // routes by Host: a caller must send Host = <app>.internal.<env-domain> for the
    // request to arrive at all, and Zitadel then rejects it as "instance not found"
    // (404); override Host to the external domain instead and ACA's own ingress
    // 404s it before Zitadel ever sees it. Both callers — the bootstrap job over
    // REST and Login V2 over gRPC — are stuck between the two.
    //
    // Zitadel's supported escape hatch for exactly this (a proxy that owns Host) is
    // to name a different header to read the instance host from. Host then stays
    // whatever ACA needs for routing, and the instance is selected out of band.
    // Publish-only: locally there is no ingress in the way and Host works.
    .WithEnvironment("ZITADEL_HTTP1HOSTHEADER", isPublish ? zitadelHostHeader : "host")
    .WithEnvironment("ZITADEL_HTTP2HOSTHEADER", isPublish ? zitadelHostHeader : ":authority")
    .WithVolume("zitadel-machinekeys", "/machinekey")
    .WithHttpHealthCheck(path: "/debug/healthz", endpointName: "http")
    .WaitFor(zitadelDb);

if (mailpit is not null)
{
    zitadel
        .WithEnvironment("ZITADEL_SMTP_HOST", $"{mailpit.Resource.Host}")
        .WithEnvironment("ZITADEL_SMTP_PORT", $"{mailpit.Resource.Port}")
        .WithEnvironment("ZITADEL_SMTP_TLS", "false");
}

// Docker named volumes are root-owned, but the Zitadel image runs as user
// `zitadel` and Login V2 as `nextjs` — neither can write the PAT files without
// this. RUN MODE ONLY: in Azure the same volume is an Azure Files share whose
// permissions come from SMB mount options, not chmod — a chmod there fails, and
// because this is gated with WaitForCompletion a non-zero exit would deadlock
// the deploy.
if (machinekeyInit is not null)
{
    zitadel.WaitForCompletion(machinekeyInit);
}

var loginV2 = builder.AddContainer("login-v2", "ghcr.io/zitadel/zitadel-login", "v4.7.3")
    // No fixed host port — the browser only ever reaches Login V2 through
    // identity-proxy's /ui/v2/login/* route, never this port directly.
    .WithHttpEndpoint(targetPort: loginV2Port, name: "http")
    .WithEnvironment("ZITADEL_SERVICE_USER_TOKEN_FILE", "/machinekey/login-client.pat")
    .WithVolume("zitadel-machinekeys", "/machinekey")
    .WaitFor(zitadel);

// Login V2 reaches Zitadel over gRPC, whose :authority is the ACA internal FQDN —
// which is not the instance's domain, so every call would come back "instance not
// found". It sends the instance host in the out-of-band header instead (see the
// ZITADEL_HTTP1HOSTHEADER note on zitadel). Publish-only, matching that switch.
if (isPublish)
{
    loginV2.WithEnvironment("CUSTOM_REQUEST_HEADERS",
        ReferenceExpression.Create($"{zitadelHostHeader}:{zitadelExternalHost}"));
}

// Zitadel core and Login V2 must share a single origin — Zitadel expects this
// even in production (specs/01-mvp/technical-implementation-spec.md §5.6):
// Login V2's redirects are relative and its session cookies aren't scoped
// cross-origin. This tiny Caddy proxy is that shared origin.
//
// It is also the DEPARTURE from spec §5.6a's App Gateway / Front Door: ACA can't
// path-route across container apps, but a proxy running inside the environment
// can — and this is the same proxy the local graph and the e2e suite already
// prove. It is published as identity-env's public ingress (see the bottom of
// this file), which is why it's a Dockerfile now rather than a bind mount.
var identityProxy = builder.AddDockerfile("identity-proxy", "../../ops/identity-proxy")
    .WithHttpEndpoint(port: zitadelPort, targetPort: zitadelPort, name: "http")
    .WithEnvironment("LISTEN_PORT", zitadelPort.ToString())
    .WithEnvironment("ZITADEL_UPSTREAM", $"{zitadel.GetEndpoint("http")}")
    .WithEnvironment("LOGIN_V2_UPSTREAM", $"{loginV2.GetEndpoint("http")}")
    .WithEnvironment("ZITADEL_HOST_HEADER", zitadelExternalHost)
    // What goes in Host on the way upstream. In Azure it must be the target app's
    // own ACA hostname or the environment's ingress cannot route the request (it
    // resolves the app by Host, and 404s an unknown one) — the instance is named
    // separately in x-zitadel-forward-host. Locally there is no ingress in the way
    // and Zitadel still resolves by Host, so both stay the browser-facing host and
    // behaviour is unchanged.
    .WithEnvironment("ZITADEL_UPSTREAM_HOST", isPublish
        ? ReferenceExpression.Create($"{zitadel.GetEndpoint("http").Property(EndpointProperty.Host)}")
        : zitadelExternalHost)
    .WithEnvironment("LOGIN_V2_UPSTREAM_HOST", isPublish
        ? ReferenceExpression.Create($"{loginV2.GetEndpoint("http").Property(EndpointProperty.Host)}")
        : zitadelExternalHost)
    // The scheme Zitadel should believe it's externally served over — it
    // stamps token issuers and resolves instances from X-Forwarded-Proto, so
    // it must match ExternalSecure above for both browser and server-side
    // callers. See the Caddyfile for why this is forced, not passed through.
    .WithEnvironment("ZITADEL_FORWARDED_PROTO", (isPublish || isCodespaces) ? "https" : "http")
    .WaitFor(zitadel)
    .WaitFor(loginV2);

// Login V2's own backend calls to Zitadel's API hit the same Host-based
// instance resolution Zitadel enforces on every request: they go out with a
// Host header of "zitadel.dev.internal:...", which doesn't match
// ExternalDomain and 404s ("instance not found"). Routing through
// identity-proxy instead lets it rewrite the Host header on the way through,
// same as it does for the browser. Set here (not in the declaration above)
// because it needs identityProxy's endpoint, which doesn't exist yet there.
//
// In Azure it goes DIRECT to Zitadel instead. These calls are gRPC, and the proxy
// hop breaks them: Caddy reverse-proxies HTTP/1.1 by default and identity-proxy's
// own ACA ingress is `http`, so the h2 frames don't survive and Login V2 fails every
// call with "protocol error: missing status" (gRPC code 13) — a 500 on the sign-in
// page. Zitadel's ingress is already Http2 (below), and the reason for the proxy hop
// is gone there anyway: instance resolution rides in x-zitadel-forward-host
// (CUSTOM_REQUEST_HEADERS on the resource), not in Host.
loginV2.WithEnvironment("ZITADEL_API_URL", isPublish
    ? ReferenceExpression.Create($"{zitadel.GetEndpoint("http")}")
    : ReferenceExpression.Create($"{identityProxy.GetEndpoint("http")}"));

// Where the API fetches signing keys and userinfo from.
//
// RUN MODE: the API is a host executable (uvicorn), so it reaches identity-proxy
// via its host-published port (localhost:8080), not a container-network hostname.
// NOTE: interpolating identityProxy.GetEndpoint("http") into a *string var* (as
// an earlier version did) captures EndpointReference.ToString() — the literal
// type name "Aspire.Hosting.ApplicationModel.EndpointReference" — because the
// eager string overload of WithEnvironment is selected instead of Aspire's lazy
// endpoint-resolving handler. That silently produced a non-URL JWKS endpoint, so
// the API could never fetch keys and every authorized request 401'd. The proxy
// listens on the fixed zitadelPort, so build the URL from that directly.
//
// PUBLISH MODE: "localhost" is meaningless — the API is its own container app in
// a different ACA environment from identity. It must go out over the public
// identity domain, which is also the issuer Zitadel stamps into the tokens.
var internalJwksUrl = isPublish
    ? ReferenceExpression.Create($"{browserFacingIssuer}/oauth/v2/keys")
    : ReferenceExpression.Create($"http://localhost:{zitadelPort.ToString()}/oauth/v2/keys");

// Zitadel omits userinfo claims (including `email`) from JWT *access* tokens —
// only the ID token and this endpoint carry them. The API mirrors `email`
// (spec §5.5), so it resolves it here on a user's first authenticated request.
var internalUserinfoUrl = isPublish
    ? ReferenceExpression.Create($"{browserFacingIssuer}/oidc/v1/userinfo")
    : ReferenceExpression.Create($"http://localhost:{zitadelPort.ToString()}/oidc/v1/userinfo");

// --- OIDC app registration ---
// Zitadel's declarative FirstInstance bootstrap (init-steps.yaml) has no
// Projects/OIDCApps section — an OIDC application's client_id is only
// obtainable by calling the Management API, and the id is generated by Zitadel
// itself so it cannot be known at graph-build time. A one-shot container calls
// the API (using the IAM_OWNER admin PAT bootstrapped alongside login-client)
// and reports the resulting client_id.
//
// Where the client_id lands differs by mode, because there is no shared host
// filesystem in Azure:
//   run     — a file under .aspire-out/, which the AppHost reads back below.
//   publish — a Key Vault secret, which the API references (stage 4b).
var oidcClientOutputDir = Path.Combine(builder.AppHostDirectory, "..", "..", ".aspire-out");
if (builder.ExecutionContext.IsRunMode)
{
    Directory.CreateDirectory(oidcClientOutputDir);
}
var oidcClientIdFile = Path.Combine(oidcClientOutputDir, "client_id.txt");

// Key Vault carries the secret that crosses a trust boundary in Azure: the OIDC
// client_id, written by the bootstrap job and read by the API (spec §9).
var identityVault = isPublish ? builder.AddAzureKeyVault("identity-kv") : null;

// The secret has to EXIST before the API's container app can be created, even
// though its real value isn't known until the bootstrap job has run.
//
// The API takes the client_id as a Key Vault secret reference, and ARM resolves
// that reference while creating the container app — so if the secret is absent
// the deployment fails outright with ResourceNotFound on
// identity-kv/secrets/oidc-client-id. But the bootstrap job can only mint the
// client_id against a *running* Zitadel, i.e. after this deploy. Nothing can
// break that cycle from inside a single deploy, so the secret is seeded with a
// placeholder here and the job overwrites it with the real value afterwards.
//
// A redeploy re-seeds the placeholder, which is why running the bootstrap job is
// a step of every deployment (ops/DEPLOY.md §5, and the deploy workflow) rather
// than a one-time setup task. GET /config returning this placeholder instead of a
// numeric client_id is exactly the "bootstrap didn't run" symptom documented there.
var oidcClientIdSeed = isPublish
    ? builder.AddParameter("oidc-client-id-seed", value: "pending-bootstrap")
    : null;
if (identityVault is not null)
{
    identityVault.AddSecret("oidc-client-id", oidcClientIdSeed!);
}

var oidcBootstrap = builder.AddDockerfile("zitadel-oidc-bootstrap", "../../ops/zitadel", "bootstrap.Dockerfile")
    .WithEnvironment("ZITADEL_API_URL", $"{zitadel.GetEndpoint("http")}")
    // Zitadel resolves its instance by the request's Host header (matching
    // ExternalDomain/ExternalPort), not by the connection address — the
    // container-network hostname above doesn't match, so every Management API
    // call 404s ("instance not found") unless this is forced.
    .WithEnvironment("ZITADEL_EXTERNAL_HOST", zitadelExternalHost)
    // Send that value in the out-of-band header instead of Host when deployed —
    // ACA's ingress owns Host there. Empty locally, where Host is still the way.
    .WithEnvironment("ZITADEL_HOST_HEADER", isPublish ? zitadelHostHeader : "")
    .WithEnvironment("ADMIN_PAT_PATH", "/machinekey/admin.pat")
    // devMode relaxes OIDC compliance checks to permit non-HTTPS localhost
    // redirects — correct locally, a real weakening of the registration in Azure.
    .WithEnvironment("OIDC_DEV_MODE", isPublish ? "false" : "true")
    .WithVolume("zitadel-machinekeys", "/machinekey")
    .WaitFor(zitadel);
// REDIRECT_URI / POST_LOGOUT_REDIRECT_URI need `web`'s origin, which doesn't
// exist yet — they're set after `web` is declared, same as loginV2's API URL.

if (identityVault is not null)
{
    oidcBootstrap
        .WithEnvironment("KEYVAULT_URI", identityVault.Resource.VaultUri)
        .WithEnvironment("CLIENT_ID_SECRET_NAME", "oidc-client-id")
        .WithReference(identityVault)
        // WithReference alone grants Key Vault Secrets *User*, which is read-only —
        // but this job's whole purpose is to WRITE the client_id it just minted, and
        // it dies at the last step with "does not have secrets/setSecret/action".
        // Officer is the least-privileged built-in role that can set a secret.
        // (The API only reads it, so it keeps the reader role from WithReference.)
        .WithRoleAssignments(identityVault, KeyVaultBuiltInRole.KeyVaultSecretsOfficer);
}
else
{
    oidcBootstrap
        .WithEnvironment("CLIENT_ID_OUTPUT_PATH", "/output/client_id.txt")
        .WithBindMount(oidcClientOutputDir, "/output");
}

// --- database migrations ---
// One-shot `alembic upgrade head` (spec §2.1's `mig` node) — gated on
// Postgres, and the API in turn waits for this to finish before it starts, so
// the schema always exists first. Working directory is the clothesline_db
// package itself (not the workspace root) because alembic.ini's
// `script_location = clothesline_db/migrations` is resolved relative to the
// process's CWD, not the ini file's own location (verified empirically) —
// `uv run` still auto-discovers the shared workspace .venv from this
// subdirectory.
// RUN MODE ONLY. In Azure, migrations are a release step, not a standing
// resource (spec §11.2) — they run as an Aspire pipeline step (see the publish
// block below), ordered ahead of the API's revision going live.
var migrate = builder.ExecutionContext.IsRunMode
    ? builder.AddExecutable(
            "clothesline-db-migrate", "uv", "../../src/backend/clothesline_db",
            "run", "alembic", "-c", "alembic.ini", "upgrade", "head")
        .WithEnvironment("ConnectionStrings__clothesline_db", appDb.Resource.ConnectionStringExpression)
        .WaitFor(appDb)
    : null;

// --- app services ---
// appDirectory is the uv *workspace root* (src/backend), not the
// clothesline_api subpackage — `uv sync` for a workspace member creates the
// one shared .venv at the workspace root, so that's where .venv/bin/uvicorn
// actually ends up.
var api = builder.AddUvicornApp("clothesline-api", "../../src/backend", "clothesline_api.main:app")
    .WithUv()
    // The Dockerfile AddUvicornApp generates on its own installs dependencies in
    // a layer that bind-mounts *only* uv.lock and the root pyproject.toml. That
    // is fine for a single-project app and broken for a uv workspace: none of the
    // members' pyproject.toml files exist in that layer, so `uv sync --locked`
    // fails with "clothesline-db references a workspace in tool.uv.sources ...
    // but is not a workspace member". Nothing in Aspire.Hosting.Python makes the
    // generated file workspace-aware, so the Dockerfile is authored here with the
    // DockerfileBuilder API — still the Aspire model, not a hand-maintained file
    // drifting alongside it.
    // ASPIREDOCKERFILEBUILDER001: the DockerfileBuilder API is still marked
    // experimental in 13.4.6. It is the only Aspire-modelled way to fix the
    // workspace bug below; the alternative is a hand-maintained Dockerfile
    // outside the model, which the repo's Aspire-owns-the-pipeline rule rules out.
#pragma warning disable ASPIREDOCKERFILEBUILDER001
    // Via PublishAsDockerFile because WithDockerfileBuilder is constrained to
    // ContainerResource, and a Uvicorn app is an ExecutableResource until publish
    // containerizes it. The inner cast pins the synchronous overload —
    // WithDockerfileBuilder also takes a Func<..., Task>, and a statement lambda
    // is ambiguous between the two.
    .PublishAsDockerFile(container => container.WithDockerfileBuilder(
        "../../src/backend",
        (Action<DockerfileBuilderCallbackContext>)(ctx =>
    {
        var dockerfile = ctx.Builder;

        // The callback APPENDS to a builder that already holds Aspire's generated
        // uv stages, and Stages is an IReadOnlyList with no reset (the missing
        // Aspire capability — its backing list is not exposed as mutable). So the
        // generated stages cannot be removed; they are instead left unbuilt. These
        // stages carry their own names and the resource publishes `workspace-app`,
        // which Docker builds with --target: only this stage and the one it copies
        // from are built, and the generated `builder`/`app` stages above them —
        // including the broken dependency layer — are never executed.
        var build = dockerfile.From("ghcr.io/astral-sh/uv:python3.12-bookworm-slim", "workspace-builder");
        build.Env("UV_COMPILE_BYTECODE", "1");
        build.Env("UV_LINK_MODE", "copy");
        build.WorkDir("/app");
        // The whole workspace goes in before the sync: uv has to see every
        // member's pyproject.toml to resolve the `workspace = true` sources the
        // root project declares. (.dockerignore keeps the host .venv out.)
        build.Copy(".", "/app");
        build.RunWithMounts("uv sync --locked --no-dev", "type=cache,target=/root/.cache/uv");

        var app = dockerfile.From("python:3.12-slim-bookworm", "workspace-app");
        app.Run("groupadd --system --gid 999 appuser "
            + "&& useradd --system --gid 999 --uid 999 --create-home appuser");
        app.CopyFrom("workspace-builder", "/app", "/app", "appuser:appuser");
        app.Env("PATH", "/app/.venv/bin:${PATH}");
        app.Env("VIRTUAL_ENV", "/app/.venv");
        app.Env("PYTHONDONTWRITEBYTECODE", "1");
        app.Env("PYTHONUNBUFFERED", "1");
        app.User("appuser");
        app.WorkDir("/app");
        // The module path and --host/--port are baked in, NOT left to the
        // resource's args. Aspire's own generated Dockerfile ends at
        // ENTRYPOINT ["uvicorn"] and assumes WithArgs(...) reaches the container,
        // but the published container app comes out with `args: null` — so uvicorn
        // starts with no application and the revision crashloops on
        // "Error: Missing argument 'APP'". CMD (not ENTRYPOINT) so the arguments
        // are still overridable from the outside.
        app.Entrypoint(["uvicorn"]);
        app.Cmd(["clothesline_api.main:app", "--host", "0.0.0.0", "--port", apiPort.ToString()]);
    }), stage: "workspace-app"))
#pragma warning restore ASPIREDOCKERFILEBUILDER001
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
    .WithEnvironment("DB_SSL_MODE", dbSslMode)
    .WithReference(blobs)
    // Browser-facing issuer vs. the URL the API fetches keys from are
    // deliberately separate values — JWT libraries validate `iss` and fetch
    // `jwks_uri` independently, and in run mode they resolve differently.
    .WithEnvironment("OIDC_ISSUER", browserFacingIssuer)
    .WithEnvironment("OIDC_JWKS_URL", internalJwksUrl)
    .WithEnvironment("OIDC_USERINFO_URL", internalUserinfoUrl)
    .WaitFor(appDb);

// The origin the browser fetches photo bytes from. Locally the API talks to
// Azurite over 127.0.0.1:10000 (its connection string) but the SAS URLs it
// mints are used by the *browser*, which under Codespaces reaches that port on
// a forwarded HTTPS subdomain instead — media/blob.py rewrites the SAS URL's
// origin to this. In Azure the SAS URL already carries the right origin, so
// this is the storage account's own blob endpoint.
api.WithEnvironment("BLOB_PUBLIC_ORIGIN", isPublish
    ? ReferenceExpression.Create($"{blobs.Resource.ConnectionStringExpression}")
    : ReferenceExpression.Create($"{PublicUrl(blobPort)}"));

if (migrate is not null)
{
    api.WaitForCompletion(migrate);
}

var web = builder.AddViteApp("clothesline-web", "../../src/frontend/clothesline-web")
    .WithHttpEndpoint(port: webPort, targetPort: webPort, env: "PORT", isProxied: false)
    .WithReference(api);

if (builder.ExecutionContext.IsRunMode)
{
    // RUN MODE ONLY. These configure the *Vite dev server*; the published image
    // is a static bundle behind nginx, where a VITE_ env var at container start
    // is read by nobody — Vite substituted these textually at build time. Setting
    // them in publish would emit VITE_API_BASE_URL='' onto the deployed container
    // app, which is not just dead config but actively misleading (empty means
    // "same origin", which is false once web and api are separate container apps).
    //
    // Empty base URL so the frontend uses same-origin relative paths (/sync,
    // /auth/me, /health), which Vite's dev-server proxy forwards to the API. This
    // avoids a cross-origin browser fetch to the API's forwarded Codespaces
    // subdomain, which GitHub's edge blocks for Private ports (see the web app's
    // vite.config.ts and the fix doc §3.2). VITE_DEV_API_TARGET is the proxy's
    // upstream — https://localhost:8000, reachable because Vite runs alongside
    // the API in the same container regardless of Codespaces.
    web.WithEnvironment("VITE_API_BASE_URL", "")
       .WithEnvironment("VITE_DEV_API_TARGET", api.GetEndpoint("https"));
}

// The OIDC issuer and client_id are NOT baked into the bundle any more — the
// API serves them over GET /config at runtime (spec §5.2). That's what breaks
// the chicken-and-egg: the client_id doesn't exist until Zitadel is deployed
// and bootstrapped, long after the web image is built.
//
// The API is therefore the one that needs the client_id.
if (identityVault is not null)
{
    api.WithEnvironment("OIDC_CLIENT_ID", identityVault.Resource.GetSecret("oidc-client-id"))
       .WithReference(identityVault);
}
else
{
    // Lazily evaluated — the file doesn't exist until the bootstrap container
    // has run, which WaitForCompletion below guarantees. (This callback used to
    // sit on `web`, where it ALSO ran during publish and made a local dev file a
    // hard dependency of deploying to Azure — `aspire deploy` died on it.)
    api.WithEnvironment("OIDC_CLIENT_ID", () => File.ReadAllText(oidcClientIdFile).Trim())
       .WaitForCompletion(oidcBootstrap);
}

// The web app's origin: Zitadel must accept it as a redirect target, and the
// API must allow it as a CORS origin. Deferred to here because `web` didn't
// exist when oidcBootstrap was declared.
var webOrigin = isPublish
    ? ReferenceExpression.Create($"{web.GetEndpoint("http")}")
    : ReferenceExpression.Create($"{PublicUrl(webPort)}");

oidcBootstrap
    .WithEnvironment("REDIRECT_URI", ReferenceExpression.Create($"{webOrigin}/auth/callback"))
    .WithEnvironment("POST_LOGOUT_REDIRECT_URI", webOrigin);

api.WithEnvironment("ALLOWED_ORIGINS", webOrigin);

// --- publish (aspire deploy → Azure Container Apps) ---
// Everything above declares the topology for BOTH modes; everything below runs
// only under `aspire publish` / `aspire deploy`, so it cannot change local
// behaviour. It has NOT yet been run against a real subscription — see
// ops/DEPLOY.md for what to check first.
if (builder.ExecutionContext.IsPublishMode)
{
    // Two ACA environments (spec §2.2): identity is blast-radius-isolated from
    // the application, and Zitadel's ingress needs settings the app's must not
    // have (http2, always-on).
    var identityEnv = builder.AddAzureContainerAppEnvironment("identity-env");
    var appEnv = builder.AddAzureContainerAppEnvironment("app-env");

    // Force the three identity apps onto ONE Azure Files share.
    //
    // WithVolume("zitadel-machinekeys", ...) is declared identically on zitadel,
    // login-v2 and the bootstrap job, but Aspire names the generated file share
    // after the *resource*, not the volume — so it emits three separate, empty
    // shares. Zitadel would write login-client.pat into its own share and Login
    // V2 would mount a different one, never see the PAT, and fail to
    // authenticate: sign-in would be broken in Azure, silently, while working
    // perfectly locally where a Docker named volume really is shared.
    //
    // ACA is happy for several managedEnvironments/storages definitions to point
    // at the same share, so repoint them all at the first one. (The now-unused
    // share resources are still provisioned — Azure.Provisioning's Infrastructure
    // has no Remove — but they're empty, unmounted and cost nothing.)
    identityEnv.ConfigureInfrastructure(infra =>
    {
        var shares = infra.GetProvisionableResources().OfType<AzureFileShare>().ToList();
        var storages = infra.GetProvisionableResources().OfType<ContainerAppManagedEnvironmentStorage>().ToList();
        var account = infra.GetProvisionableResources().OfType<StorageAccount>().FirstOrDefault();

        if (shares.Count > 0)
        {
            var shared = shares[0];
            foreach (var storage in storages)
            {
                storage.Properties.AzureFile.ShareName = shared.Name;

                // Aspire emits azureFile with *only* a shareName, and ACA rejects
                // that: "Must contain 'AccountName', 'AccountKey', 'ShareName' and
                // 'AccessMode' when setting Azure File Share Storage." The
                // properties exist on the model but nothing populates them (the
                // missing Aspire capability), so the mount is wired up here.
                // ReadWrite, not ReadOnly — Zitadel writes its PAT into the share
                // and Login V2 reads it back (see the note above).
                if (account is not null)
                {
                    storage.Properties.AzureFile.AccountName = account.Name;
                    storage.Properties.AzureFile.AccessMode = ContainerAppAccessMode.ReadWrite;

                    // account.listKeys().keys[0].value, spelled out.
                    //
                    // The typed route doesn't survive: GetKeys() is a lazy Bicep
                    // expression rather than a real collection, so .First() throws
                    // "Sequence contains no elements" and the [0] indexer hands back
                    // a BicepValue whose .Value is null. Both fail at publish, before
                    // any Bicep is written. Building the expression by hand is the
                    // way to reference a key that only exists at deployment time.
                    var listKeys = new FunctionCallExpression(
                        new MemberExpression(new IdentifierExpression(account.BicepIdentifier), "listKeys"));
                    storage.Properties.AzureFile.AccountKey = new BicepValue<string>(
                        new MemberExpression(
                            new IndexExpression(new MemberExpression(listKeys, "keys"), new IntLiteralExpression(0)),
                            "value"));
                }
            }
        }

        // ...and give each storage a name that survives truncation.
        //
        // Aspire names them take('managedstoragevolumes<resource>', 24). That
        // prefix is 21 characters on its own, so only three characters of the
        // resource name survive and the uniqueString() meant to disambiguate them
        // is cut off entirely: `zitadel` and `zitadel-oidc-bootstrap` both come
        // out as `managedstoragevolumeszit` and ARM rejects the whole template
        // with "defined multiple times". The index leads so the names stay
        // distinct no matter what the limit truncates.
        //
        // Renaming here is enough: each container app reads the name back through
        // an identity-env output rather than recomputing it, so the mounts follow.
        for (var i = 0; i < storages.Count; i++)
        {
            storages[i].Name = $"machinekeys{i}";
        }
    });

    api.WithComputeEnvironment(appEnv);
    web.WithComputeEnvironment(appEnv);
    zitadel.WithComputeEnvironment(identityEnv);
    loginV2.WithComputeEnvironment(identityEnv);
    identityProxy.WithComputeEnvironment(identityEnv);
    oidcBootstrap.WithComputeEnvironment(identityEnv);

    // The published web image is nginx serving a static bundle on :80 — NOT the
    // Vite dev server. The endpoint declared above carries targetPort 5173 because
    // that is the dev server's port in run mode, and ACA would faithfully route
    // ingress there, to a port nothing is listening on: the app answers nothing and
    // the revision never becomes reachable. Publish-only override, so run mode keeps
    // talking to Vite on 5173.
    web.PublishAsAzureContainerApp((_, app) =>
    {
        app.Configuration.Ingress.TargetPort = 80;
    });

    // The machine-key share has to be WRITABLE BY A NON-ROOT USER, and on Azure
    // Files that is decided by mount options, not by chmod.
    //
    // Zitadel runs as `zitadel` and Login V2 as `nextjs` (uid 1001); the SMB mount
    // defaults to root-owned with no write access for either. Zitadel's
    // 03_default_instance migration writes its admin PAT into /machinekey, so on the
    // default mount it fails — and because Zitadel records the migration as *started*
    // before it fails, the lock outlives the pod and every subsequent boot sits in
    // "migration already started, will check again in 5 seconds" forever. The IdP
    // never serves, Login V2 never sees the PAT, and the bootstrap job times out
    // waiting for /machinekey/admin.pat. This one line is the difference between a
    // working identity environment and one that looks alive but never finishes booting.
    //
    // (This is the failure ops/DEPLOY.md called the most likely one — it was right.)
    // World-writable rather than a single uid, because three different images with
    // three different users share this one mount.
    const string machineKeyMountOptions = "dir_mode=0777,file_mode=0777,mfsymlinks,nobrl";

    // Zitadel serves its management/admin gRPC over HTTP/2, and ACA's default
    // `auto` transport doesn't carry h2c end-to-end (spec §5.6b). It also must
    // not scale to zero — an IdP's cold start lands squarely on the login path,
    // and it runs background projections.
    zitadel.PublishAsAzureContainerApp((_, app) =>
    {
        app.Configuration.Ingress.Transport = ContainerAppIngressTransportMethod.Http2;
        app.Configuration.Ingress.External = false; // only identity-proxy is public
        app.Template.Scale.MinReplicas = 1;
        foreach (var volume in app.Template.Volumes)
        {
            volume.Value.MountOptions = machineKeyMountOptions;
        }
        // ...and MAX 1, because Zitadel runs its own schema setup on boot and that
        // is not concurrency-safe. Several replicas race the same migration: one
        // takes the lock, the others time out in checkExec (MIGR-as3f7), and if the
        // holder is scaled away mid-migration the lock survives it — every later
        // boot then sits in "migration already started, will check again in 5
        // seconds" forever, never serving and never writing the admin PAT that
        // Login V2 and the bootstrap job wait on. An IdP this size has no reason to
        // scale out anyway; keeping it a singleton makes the boot path deterministic.
        app.Template.Scale.MaxReplicas = 1;
    });
    loginV2.PublishAsAzureContainerApp((_, app) =>
    {
        app.Configuration.Ingress.External = false; // reached only via identity-proxy
        app.Template.Scale.MinReplicas = 1;
        foreach (var volume in app.Template.Volumes)
        {
            volume.Value.MountOptions = machineKeyMountOptions;
        }
    });

    // The single-origin requirement (spec §5.6a) is met by publishing the same
    // Caddy proxy we already run locally as the identity environment's public
    // ingress, rather than by standing up App Gateway/Front Door: ACA can't
    // path-route *across* apps, but a proxy container inside it can, and this
    // one is already proven by the local graph and the e2e suite.
    identityProxy.PublishAsAzureContainerApp((_, app) =>
    {
        app.Configuration.Ingress.External = true;
        app.Template.Scale.MinReplicas = 1;

        // The custom domain binds HERE and only here — identity-proxy is the
        // identity environment's only public ingress. It must be the same value
        // as identity-domain above, because Zitadel resolves its instance from
        // the Host header: if DNS and the parameter disagree, every request gets
        // "instance not found".
        //
        // ...but ONLY once `bind-identity-domain` says the DNS records exist.
        // Azure validates domain ownership the moment the hostname is attached —
        // even with the binding Disabled — and rejects the deployment with
        // InvalidCustomHostNameValidation if the records are absent. They cannot be
        // present on a first deploy: the TXT record carries a verification id and
        // the CNAME points at an FQDN, and *neither exists until this container app
        // has been deployed at least once*. Attaching unconditionally therefore
        // makes the first deploy of a fresh environment impossible.
        //
        // The certificate is a separate gate (see the parameters near the top):
        // attaching the hostname is itself a precondition for Azure to issue the
        // certificate, so binding cannot wait for one. See ops/DEPLOY.md §3.
        //
        // Done through the model rather than `az` (CLAUDE.md's rule): Aspire has
        // ConfigureCustomDomain, so no fallback is needed here after all.
        //
        // ASPIREACADOMAINS001: the API is marked "for evaluation purposes only
        // and is subject to change or removal". Suppressed deliberately — the
        // alternative is dropping to `az containerapp hostname add`, i.e. exactly
        // the drift out of the model that CLAUDE.md forbids. If a future Aspire
        // release removes it, this is the line to revisit.
        if (bindIdentityDomain)
        {
#pragma warning disable ASPIREACADOMAINS001
            app.ConfigureCustomDomain(identityDomain!, certificateName!);
#pragma warning restore ASPIREACADOMAINS001
        }
    });

    // The OIDC bootstrap is one-shot, not a service: it registers the web app
    // with Zitadel and exits. A Container Apps *Job* is the right shape — a
    // standing app would restart it forever.
    oidcBootstrap.PublishAsAzureContainerAppJob((_, job) =>
    {
        job.Configuration.ReplicaTimeout = 600;
        // Reads /machinekey/admin.pat off the same share Zitadel writes it to, so
        // it needs the same mount options — see the note above.
        foreach (var volume in job.Template.Volumes)
        {
            volume.Value.MountOptions = machineKeyMountOptions;
        }
    });

    // The browser talks to BOTH of these directly — it loads the app from `web`
    // and then calls the API cross-origin (they're separate container apps with
    // separate FQDNs), so both need public ingress. Without this they default to
    // internal-only and the app is unreachable.
    web.WithExternalHttpEndpoints();
    api.WithExternalHttpEndpoints();

    // The web bundle bakes VITE_API_BASE_URL in at build time — Vite substitutes
    // import.meta.env textually, so the API's URL must be known before the image
    // is built, and cannot be changed afterwards by an env var.
    //
    // The endpoint is "https" (AddUvicornApp always launches uvicorn with a dev
    // cert, so the endpoint had to be declared Https — see WithHttpsEndpoint
    // above); asking for "http" here silently yields the wrong URL.
    //
    // The URL is composed from the ACA environment's default domain, NOT from
    // api.GetEndpoint("https").
    //
    // A container app's endpoint is not a build-time-resolvable value: Aspire never
    // feeds the provisioned FQDN back into the endpoint reference, so awaiting it
    // during the image build blocks forever. The deploy hangs on "Building image:
    // clothesline-web" without ever invoking Docker, and no amount of step ordering
    // helps — the value simply never arrives. (Verified: swap in a literal and the
    // same build finishes in 32s.)
    //
    // The environment's defaultDomain *is* an output of its Bicep module, and an
    // externally-ingressed app's FQDN is deterministically <app>.<defaultDomain>
    // (internal-only apps get <app>.internal.<defaultDomain> — the API is external,
    // set by WithExternalHttpEndpoints above). So this composes the same URL the
    // endpoint would have produced, from a value the deploy actually resolves.
    var appEnvDomain = new BicepOutputReference(
        "AZURE_CONTAINER_APPS_ENVIRONMENT_DEFAULT_DOMAIN", appEnv.Resource);
    web.PublishAsDockerFile(c => c.WithBuildArg(
        "VITE_API_BASE_URL",
        ReferenceExpression.Create($"https://clothesline-api.{appEnvDomain}")));
    api.PublishAsDockerFile();

    // ...and that ordering is NOT there by default, which deadlocks the deploy.
    //
    // `build-clothesline-web` is generated with dependencies on the build prereqs
    // only, so it starts immediately — then blocks forever resolving the build arg
    // above, because the API's endpoint has no value until its container app is
    // provisioned. The build never invokes Docker at all; the deploy simply hangs
    // with "Building image: clothesline-web" as its last line.
    //
    // So the value dependency is made an explicit step dependency. This is the
    // Aspire-modelled fix (Pipelines API); the alternative — passing the API's URL
    // in as a hand-managed parameter — would hard-code a value the model already
    // knows and drift the moment the app moves.
    //
    // ASPIREPIPELINES001: the Pipelines API is marked experimental in 13.4.6.
#pragma warning disable ASPIREPIPELINES001
    web.WithPipelineConfiguration(ctx =>
    {
        // Bind to the step object, not its name: the DependsOn(string) overload is
        // validated against whichever step set the current pipeline holds, and a
        // pipeline without the provisioning steps (e.g. `publish`, which builds
        // images but provisions nothing) fails outright with "depends on unknown
        // step". Looking it up and skipping when it is absent keeps publish working
        // and constrains deploy, which is the only pipeline that has both.
        var provisionApi = ctx.Steps
            .FirstOrDefault(s => s.Name == "provision-clothesline-api-containerapp");
        if (provisionApi is null)
        {
            return;
        }

        foreach (var step in ctx.GetSteps(web.Resource, "build-compute"))
        {
            step.DependsOn(provisionApi);
        }
    });
#pragma warning restore ASPIREPIPELINES001
}

builder.Build().Run();
