# CLAUDE.md

Guidance for working in this repository.

## What this is

**Clothesline** — an offline-first PWA for tracking laundry sent to and received from per-kilo laundry shops. Product docs live in [`business/`](./business); the Phase 1 technical spec lives in [`specs/01-mvp/`](./specs/01-mvp/technical-implementation-spec.md). Read the spec before implementing MVP features.

## Orchestration & infrastructure — Aspire (aspire.dev)

The **repo root uses [Aspire](https://aspire.dev) for pipeline and infrastructure management.** The Aspire **AppHost** (`aspire/Clothesline.AppHost`) is the single source of truth for the application topology: it declares every service and backing resource, wires connection strings and service discovery between them, runs the whole graph locally, and drives provisioning + deployment to the cloud.

- **Run everything locally:** `aspire run` — boots the API, the web app, Postgres, and the Blob emulator (Azurite) together, with a dashboard for logs, traces, and metrics.
- **Deploy:** the app is deployed as **Docker containers to Azure Container Apps (ACA)**, provisioned from the Aspire model via `azd up`. Do not hand-maintain per-environment config — let Aspire wire it.
- Secrets and connection strings come from Aspire resource wiring (Key Vault in Azure, dev-container/Aspire config locally). Never commit secrets.

## Dev container

The repo ships a **dev container** (`.devcontainer/`). Do development inside it — it provides Python 3.12 + `uv`, Node.js, the .NET SDK with the Aspire workload, and Docker access, so `aspire run` works out of the box.

## Tech stack

| Area | Choice |
|---|---|
| Orchestration / infra | Aspire (aspire.dev), deploy to Azure Container Apps |
| Backend | Python + **FastAPI**, **`uv`** for dependencies & packaging |
| Backend data | PostgreSQL |
| Frontend | **Vite** + **React** (TypeScript), PWA (offline-first) |
| Photo storage | Azure Blob Storage (Azurite locally) |
| Backend tests | pytest |
| Frontend unit tests | Vitest |
| E2E tests | **Playwright** |

## Folder structure

```
/
├── .devcontainer/                dev container definition
├── aspire/
│   └── Clothesline.AppHost/       Aspire AppHost (topology, azd target)
├── business/                      product / PRD docs
├── specs/                         technical specs (01-mvp = Phase 1)
└── src/
    ├── backend/
    │   ├── clothesline_api/        FastAPI app (backend module)
    │   └── clothesline_tests/      pytest project
    └── frontend/
        ├── clothesline-web/        Vite + React PWA (frontend module)
        └── clothesline-e2e/        Playwright e2e tests
```

Backend is a modular monolith (one deployable, split internally by domain: `auth`, `loads`, `media`, `sync`). Frontend Vitest unit tests are colocated in `clothesline-web`; Playwright e2e is its own project so it can drive the built PWA including offline flows.

## Conventions

- **Dependencies:** backend uses `uv` (`uv add`, `uv run`) with `pyproject.toml` — do not use bare `pip`. Frontend uses the Vite/npm toolchain.
- **Offline-first is a hard requirement:** create-load, itemize, mark-sent, and enter-received-count must work with no network. The client (IndexedDB) is the system of record during a session and syncs to the API when online. Don't add a server round-trip to the core counter flow.
- **Playwright:** Chromium is pre-installed at `/opt/pw-browsers/chromium`. Do **not** run `playwright install`.
- **IDs are client-generated UUIDs** for Load/LoadItem/Photo so offline creates survive sync.
- Keep product decisions in `business/`, technical decisions in `specs/`. Update the spec when the design changes.
