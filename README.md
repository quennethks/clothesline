# Clothesline

An offline-first Progressive Web App for tracking laundry sent to and received from per-kilo laundry shops. Itemize a load at the counter in under a minute, catch a shortfall before you leave the shop, and keep a record no claim stub ever gave you.

Metro Manila professionals who outsource laundry by the kilo have no itemized record of what they hand over — Clothesline closes that gap with a fast, offline-capable send/receive checklist.

## Status

Phase 1 (MVP) is under active development. See [`specs/01-mvp/implementation-plan.md`](./specs/01-mvp/implementation-plan.md) for the current milestone and build order.

## Tech stack

| Area | Choice |
|---|---|
| Orchestration / infra | [Aspire](https://aspire.dev), deployed to Azure Container Apps |
| Backend | Python 3.12, FastAPI, [`uv`](https://docs.astral.sh/uv/) |
| Backend data | PostgreSQL (SQLAlchemy + Alembic) |
| Identity | Self-hosted [Zitadel](https://zitadel.com) (OIDC), passwordless email OTP |
| Frontend | Vite + React (TypeScript), installable PWA |
| Offline store / sync | RxDB (IndexedDB) as local system of record, replicated to the API |
| Photo storage | Azure Blob Storage (Azurite locally) |
| Backend tests | pytest |
| Frontend unit tests | Vitest |
| E2E tests | Playwright |

See [`CLAUDE.md`](./CLAUDE.md) for the full architecture and conventions.

## Getting started

The repo ships a [dev container](./.devcontainer) with everything needed pre-installed (Python + `uv`, Node.js, the .NET SDK + Aspire workload, Docker). Open the repo in the container and dependencies install automatically.

```bash
# Run the whole stack — web, api, Postgres, Azurite, Zitadel, Mailpit
cd aspire/Clothesline.AppHost
aspire run
```

This opens the Aspire dashboard with logs, traces, and metrics for every service.

**Running in a GitHub Codespace:** to sign in **by hand**, set the forwarded **`identity-proxy`** port to **Public** visibility in the Ports panel (Ports tab → right-click the port → Port Visibility → Public). It serves unauthenticated first-time sign-in requests, and a background browser fetch to a Private port gets silently blocked at GitHub's edge — see [`specs/01-mvp/fixes/2026-07-05-codespaces-oidc-signin.md`](./specs/01-mvp/fixes/2026-07-05-codespaces-oidc-signin.md) if sign-in still fails after that.

### Running tests

```bash
# Backend
cd src/backend
uv run pytest
uv run ruff check .
uv run mypy .

# Frontend
cd src/frontend/clothesline-web
npm run test
npm run lint
npm run typecheck

# End-to-end (needs the graph running — see below)
cd src/frontend/clothesline-e2e
npx playwright test
```

**Playwright in a Codespace:** the e2e suite targets `http://localhost:5173` and expects the OIDC issuer to be `http://localhost:8080`. Inside a Codespace the AppHost instead points the issuer at the forwarded `*.app.github.dev` URL, and a *public* forwarded port serves GitHub's "you are about to access a development port" interstitial — which the browser hits instead of Zitadel, so every test fails at sign-in. Run the graph with the Codespaces variables unset so everything stays on localhost:

```bash
env -u CODESPACES -u CODESPACE_NAME -u GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN aspire run
```

## Deployment

Deployed as Docker containers to **Azure Container Apps**, across two ACA environments (identity vs. application), driven entirely by the Aspire CLI:

```bash
aspire publish -o ./artifacts   # render the Bicep — no subscription, no cost
aspire deploy -e Staging        # provision + build + push + deploy
aspire destroy -e Staging       # tear down
```

`azd` is not used. Deployment logic lives in the AppHost, not in CI YAML — see [`CLAUDE.md`](./CLAUDE.md).

**[`ops/DEPLOY.md`](./ops/DEPLOY.md) is the runbook** — prerequisites, the custom-domain binding, migrations, the OIDC bootstrap, smoke checks and the known issues. Read it before your first deploy: `aspire deploy` alone does *not* run migrations or register the OIDC app, and the identity domain must be settled up front.

Running the deploy from CI instead of your own shell? **[`ops/GITHUB-ACTIONS-SETUP.md`](./ops/GITHUB-ACTIONS-SETUP.md)** covers the one-time GitHub→Azure wiring — the federated (OIDC) credential, RBAC, and the repo secrets/variables the workflow needs.

> The deploy path has never been run against a real subscription. Treat the first one as an experiment.

## Project structure

```
/
├── .devcontainer/          dev container definition
├── aspire/
│   └── Clothesline.AppHost/  Aspire AppHost (local topology + cloud deploy target)
├── business/               product research, PRDs
├── ops/                    infra bootstrap config (e.g. Zitadel init steps)
├── specs/                  technical specs and implementation plans
└── src/
    ├── backend/
    │   ├── clothesline_db/    shared data package: ORM models + Alembic migrations
    │   ├── clothesline_api/   FastAPI app
    │   └── clothesline_tests/ pytest suite
    └── frontend/
        ├── clothesline-web/   Vite + React PWA
        └── clothesline-e2e/   Playwright e2e tests
```

## Documentation

- [`business/`](./business) — problem statement, market research, competitive analysis, and product requirements
- [`specs/01-mvp/`](./specs/01-mvp) — technical implementation spec and milestone-by-milestone build plan
- [`CLAUDE.md`](./CLAUDE.md) — architecture, conventions, and orchestration notes for contributors
