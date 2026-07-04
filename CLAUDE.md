# CLAUDE.md

Guidance for working in this repository.

## What this is

**Clothesline** — an offline-first PWA for tracking laundry sent to and received from per-kilo laundry shops. Product docs live in [`business/`](./business); the Phase 1 technical spec lives in [`specs/01-mvp/`](./specs/01-mvp/technical-implementation-spec.md). Read the spec before implementing MVP features.

## Orchestration & infrastructure — Aspire (aspire.dev)

The **repo root uses [Aspire](https://aspire.dev) for pipeline and infrastructure management.** The Aspire **AppHost** (`aspire/Clothesline.AppHost`) is the single source of truth for the application topology: it declares every service and backing resource, wires connection strings and service discovery between them, runs the whole graph locally, and drives provisioning + deployment to the cloud.

- **Run everything locally:** `aspire run` — boots the API, the web app, Postgres, the Blob emulator (Azurite), the **Zitadel** identity server (core + Login V2), and Mailpit together, with a dashboard for logs, traces, and metrics.
- **Deploy:** the app is deployed as **Docker containers to Azure Container Apps (ACA)** across **two ACA environments** (identity vs. application), provisioned from the Aspire model via `azd up`. Do not hand-maintain per-environment config — let Aspire wire it.
- Secrets and connection strings come from Aspire resource wiring (Key Vault in Azure, dev-container/Aspire config locally). Never commit secrets.

## Dev container

The repo ships a **dev container** (`.devcontainer/`). Do development inside it — it provides Python 3.12 + `uv`, Node.js, the .NET SDK with the Aspire workload, and Docker access, so `aspire run` works out of the box.

## Tech stack

| Area | Choice |
|---|---|
| Orchestration / infra | Aspire (aspire.dev), deploy to Azure Container Apps (two environments) |
| Backend | Python + **FastAPI**, **`uv`** for dependencies & packaging |
| Backend data | PostgreSQL; shared **`clothesline_db`** package (ORM models + Alembic migrations) |
| Identity / auth | Self-hosted **Zitadel** (OIDC), passwordless email OTP via **Login V2**; API validates JWTs against Zitadel's JWKS |
| Frontend | **Vite** + **React** (TypeScript), PWA (offline-first) |
| Offline store / sync | **RxDB** (IndexedDB storage) as the local system of record; **RxDB replication** to the API's generic `/sync/{collection}` endpoint |
| Photo storage | Azure Blob Storage (Azurite locally) |
| Backend tests | pytest |
| Frontend unit tests | Vitest |
| E2E tests | **Playwright** |

## Folder structure

> **Target layout** — `aspire/` and `src/` do not exist yet; they will be created as the MVP is built.

```
/
├── .devcontainer/                dev container definition
├── aspire/
│   └── Clothesline.AppHost/       Aspire AppHost (topology, azd target)
├── business/                      product / PRD docs
├── specs/                         technical specs (01-mvp = Phase 1)
└── src/
    ├── backend/
    │   ├── clothesline_db/         shared data package: ORM models + Alembic migrations
    │   ├── clothesline_api/        FastAPI app (backend module, imports clothesline_db)
    │   └── clothesline_tests/      pytest project
    └── frontend/
        ├── clothesline-web/        Vite + React PWA (frontend module)
        └── clothesline-e2e/        Playwright e2e tests
```

Backend is a modular monolith (one deployable, split internally by domain: `auth`, `domain`, `media`, `sync`). **ORM models and Alembic migrations live in the shared `clothesline_db` package** (imported by the API), not inside the domain modules — chosen for maintainability and to let a future second deployable share the schema. The `auth` module does not issue tokens; it validates Zitadel JWTs and keeps a minimal `User {id, sub, email}` mirror (email is the only PII stored). Frontend Vitest unit tests are colocated in `clothesline-web`; Playwright e2e is its own project so it can drive the built PWA including offline flows.

## Diagrams

- **Prefer Mermaid for all diagrams** — architecture, flows, sequences, state machines, ER diagrams, etc. Use Mermaid as much as possible so diagrams stay version-controlled, diffable, and render inline in Markdown.
- **If something can't be expressed in a Mermaid graph** (e.g. a rich UI mockup, an annotated screenshot, a free-form layout), **do not silently substitute another format.** Prompt the user first, describing how you intend to illustrate it, and get confirmation on the approach before proceeding.

## Conventions

- **Dependencies:** backend uses `uv` (`uv add`, `uv run`) with `pyproject.toml` — do not use bare `pip`. Frontend uses the Vite/npm toolchain.
- **Offline-first is a hard requirement:** create-load, itemize, mark-sent, and enter-received-count must work with no network. The client (**RxDB over IndexedDB**) is the system of record during a session; **RxDB replication** syncs to the API's generic `/sync/{collection}` endpoint when online. Loads/items have **no REST CRUD** — send/receive/reconcile/duplicate are local RxDB writes, validated server-side at push time. Don't add a server round-trip to the core counter flow.
- **Playwright:** Chromium is pre-installed at `/opt/pw-browsers/chromium`. Do **not** run `playwright install`.
- **IDs are client-generated UUIDs** for Load/LoadItem/Photo so offline creates survive sync.
- **Identity is Zitadel's job, not ours.** Don't build password flows, token issuance, or OTP storage — the API only validates Zitadel-issued JWTs (JWKS). Self-hosting Zitadel on ACA has specific requirements (Login V2 as its own container + path routing, `http2` ingress, external-TLS mode) — see spec §5.6 before touching deploy.
- **DB migrations run as a CI/CD pipeline step** (`alembic upgrade head` from `clothesline_db`), not as a standing ACA job (spec §11.2).
- Keep product decisions in `business/`, technical decisions in `specs/`. Update the spec when the design changes.
