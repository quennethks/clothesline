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

**Running in a GitHub Codespace:** before signing in, set the forwarded **`identity-proxy`** port to **Public** visibility in the Ports panel (Ports tab → right-click the port → Port Visibility → Public). It serves unauthenticated first-time sign-in requests, and a background browser fetch to a Private port gets silently blocked at GitHub's edge — see [`specs/01-mvp/fixes/2026-07-05-codespaces-oidc-signin.md`](./specs/01-mvp/fixes/2026-07-05-codespaces-oidc-signin.md) if sign-in still fails after that.

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
```

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
