# Deploying Clothesline to Azure

> **Status: written, not yet run.** Everything else in this repo is verified —
> the local graph boots on `aspire run`, and the Playwright suite drives it end
> to end. The deploy path below has **never been executed against a real
> subscription**, because there wasn't one to hand. Expect the first `azd up` to
> surface issues; the known-unresolved ones are listed at the bottom, and they
> are the places to look first.

## The shape of it (spec §2.2, §11)

Two ACA environments, provisioned from the Aspire model:

| Environment | Contains |
|---|---|
| **identity-env** | Zitadel core, Login V2, `identity-proxy` (the public ingress), Postgres #1 |
| **app-env** | web, API, Postgres #2, Blob Storage |

`aspire/Clothesline.AppHost/apphost.cs` is the single source of truth for both.
The publish-only wiring lives at the bottom of that file, guarded by
`IsPublishMode`, so none of it can affect `aspire run`.

### One deliberate departure from spec §5.6a

The spec calls for **App Gateway or Front Door** to give Zitadel core and Login
V2 a single origin with path routing, because ACA cannot path-route *across*
container apps.

We do it with the **`identity-proxy` Caddy container instead**, published into
`identity-env` as its public ingress, with Zitadel and Login V2 both internal-only
behind it. ACA can't path-route across apps, but a proxy running *inside* it can
— and this is the same proxy the local graph already uses, so the routing, the
header rewriting (`X-Forwarded-Host`, `x-zitadel-*`) and the single-origin
session behaviour are all already exercised by the e2e suite. It also drops a
whole Azure service from the bill.

## Running it

```bash
azd auth login
azd env new clothesline-prod
azd up
```

`azd up` provisions both environments and deploys the containers. The Zitadel
requirements from spec §5.6b are set in the AppHost: `transport: http2` on
Zitadel's ingress (ACA's default `auto` doesn't carry h2c end-to-end, which
breaks its gRPC APIs), external-TLS mode, and `minReplicas: 1` on the identity
services so an IdP cold start never lands on the login path.

## Database migrations (spec §11.2)

Migrations run as a **pipeline step**, not a standing ACA job:

```bash
cd src/backend/clothesline_db
uv run alembic -c alembic.ini upgrade head
```

`.github/workflows/deploy.yml` runs this **before** the API revision goes live,
so the schema is never behind the code that queries it.

## Known-unresolved, look here first

1. **Zitadel's Postgres host.** Zitadel takes discrete
   `ZITADEL_DATABASE_POSTGRES_HOST/PORT/USER/...` env vars — it has no
   connection-string form. Locally those come off the Postgres *container*
   resource. Against an Azure Flexible Server the FQDN isn't known until after
   provisioning, so the first `azd up` will need the host wired through (a
   parameter, or a bicep output reference) — this is the single most likely
   thing to fail, and it is unwired today.
2. **`sslmode=require`.** Azure Postgres enforces TLS; the local wiring sets
   `disable`. That has to flip in publish mode.
3. **Custom domain.** Zitadel bakes `ExternalDomain` into token issuers and
   cookies, so the issuer URL must be stable *before* first boot — the
   generated ACA FQDN is a chicken-and-egg (spec §5.6b). Plan on a custom
   domain on `identity-proxy` from the start.
4. **The OIDC client bootstrap.** `ops/zitadel/bootstrap_oidc_app.py` writes the
   generated `client_id` to a bind mount that the web app reads at build time.
   That file-passing trick doesn't exist in ACA — the client id needs to reach
   the web app another way (Key Vault, or a build-time parameter).
5. **Blob CORS + `BLOB_PUBLIC_ORIGIN`.** The browser PUTs photo bytes straight
   to Blob, so the storage account must allow the web app's real origin. The API
   sets this on startup from `ALLOWED_ORIGINS`; confirm it lands.
