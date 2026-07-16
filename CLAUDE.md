# CLAUDE.md

Guidance for working in this repository.

## What this is

**Clothesline** — an offline-first PWA for tracking laundry sent to and received from per-kilo laundry shops. Product docs live in [`business/`](./business); the Phase 1 technical spec lives in [`specs/01-mvp/`](./specs/01-mvp/technical-implementation-spec.md). Read the spec before implementing MVP features.

## Orchestration & infrastructure — Aspire (aspire.dev)

The **repo root uses [Aspire](https://aspire.dev) for pipeline and infrastructure management.** The Aspire **AppHost** (`aspire/Clothesline.AppHost`) is the single source of truth for the application topology: it declares every service and backing resource, wires connection strings and service discovery between them, runs the whole graph locally, and drives provisioning + deployment to the cloud.

- **Run everything locally:** `aspire run` — boots the API, the web app, Postgres, the Blob emulator (Azurite), the **Zitadel** identity server (core + Login V2), and Mailpit together, with a dashboard for logs, traces, and metrics.
- **Deploy:** the app is deployed as **Docker containers to Azure Container Apps (ACA)** across **two ACA environments** (identity vs. application), provisioned from the Aspire model via **`aspire deploy`** (`aspire publish` for artifacts only, `aspire destroy` to tear down). Do not hand-maintain per-environment config — let Aspire wire it.
- Secrets and connection strings come from Aspire resource wiring (Key Vault in Azure, dev-container/Aspire config locally). Never commit secrets.

### Aspire owns the deployment pipeline

- **Deployment work is expressed in the AppHost, not in CI YAML.** Provisioning, image build/push, database migrations, post-deploy bootstrap and teardown are all driven by the Aspire CLI (`aspire deploy` / `aspire do <step>`). The AppHost is the single source of truth for *how the app is deployed*, exactly as it already is for *what the app is made of*.
- **GitHub Actions is a trigger, not a deployment tool.** Its job is limited to reacting to the git event, checkout, authenticating to Azure, running the quality gates (ruff, mypy, eslint, tsc, pytest, Vitest, Playwright), and invoking `aspire deploy`.
- **Reaching for another tool requires evidence, not convenience.** Before falling back to `az`, `azd` or raw shell for a deployment concern, establish that Aspire genuinely has no model for it — check the `Aspire.Hosting.*` API surface and `aspire deploy --list-steps`, not just the docs. Any fallback must carry a comment naming the missing Aspire capability, so it stays a visible exception rather than quiet drift back to bash. (`azd` is **not** used in this repo.)

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
│   └── Clothesline.AppHost/       Aspire AppHost (topology + deployment pipeline)
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

## Specs are append-only — annotate, don't rewrite

A spec records *the decision that was made*, and that stays true even once it's been overtaken. So when a later spec overrides an earlier one, **do not edit the earlier spec's text.** Rewriting it in place destroys the trail: a reader can no longer tell whether the section always said that, or whether someone quietly changed it because reality disagreed.

Instead:

1. **Annotate in place.** Immediately above the superseded passage, add a dated callout naming what changed in one line and linking to the **exact section** that overrides it:
   > ⚠️ **Superseded — <date>, by [Phase X §N "<heading>"](<relative-link>#anchor).** <One line on what changed and why.> The <passage> is left unchanged below as the original decision.
2. **Index it.** Add a row to the **"Amendments to this spec"** table under the document header, so a reader sees at a glance what has moved on without scrolling the whole document. (See [`specs/01-mvp/technical-implementation-spec.md`](./specs/01-mvp/technical-implementation-spec.md) for the shape of both.)
3. **Make the trail two-way.** The *new* spec carries a **Supersessions** section declaring what it overrides, so the story is readable from either end.

**Supersede reversed *decisions*, not everything.** This convention earns its keep only while the callouts stay rare and coarse. A typo, a clarification, or a passage that is merely *adjacent* to the change gets no banner — annotate the section where a decision actually flipped, and say explicitly in the new spec's Supersessions section what you chose **not** to annotate, and why. A spec thicketed with banners is less readable than one that was never annotated at all.

> Links point at Markdown heading anchors and nothing verifies them — rename a heading and the trail rots silently. Keep headings stable once they've been linked.

## Diagrams

- **Prefer Mermaid for all diagrams** — architecture, flows, sequences, state machines, ER diagrams, etc. Use Mermaid as much as possible so diagrams stay version-controlled, diffable, and render inline in Markdown.
- **If something can't be expressed in a Mermaid graph** (e.g. a rich UI mockup, an annotated screenshot, a free-form layout), **do not silently substitute another format.** Prompt the user first, describing how you intend to illustrate it, and get confirmation on the approach before proceeding.

## Conventions

- **Commits follow [Conventional Commits](https://www.conventionalcommits.org) — strictly.** Every commit message is `type(scope): summary`, where `type` is one of `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `build`, `ci`, `perf`, `style`, `revert`. Use a scope where it clarifies (`feat(web):`, `fix(api):`, `ci(deploy):`); mark a breaking change with `!` after the type/scope (`feat(api)!:`) or a `BREAKING CHANGE:` footer. This is not optional — the existing history (`feat(web):`, `fix(web):`) already follows it, and it must stay consistent.
- **Dependencies:** backend uses `uv` (`uv add`, `uv run`) with `pyproject.toml` — do not use bare `pip`. Frontend uses the Vite/npm toolchain.
- **Offline-first is a hard requirement:** create-load, itemize, mark-sent, and enter-received-count must work with no network. The client (**RxDB over IndexedDB**) is the system of record during a session; **RxDB replication** syncs to the API's generic `/sync/{collection}` endpoint when online. Loads/items have **no REST CRUD** — send/receive/reconcile/duplicate are local RxDB writes, validated server-side at push time. Don't add a server round-trip to the core counter flow.
- **Playwright:** Chromium is pre-installed at `/opt/pw-browsers/chromium`. Do **not** run `playwright install`.
- **IDs are client-generated UUIDs** for Load/LoadItem/Photo so offline creates survive sync.
- **Identity is Zitadel's job, not ours.** Don't build password flows, token issuance, or OTP storage — the API only validates Zitadel-issued JWTs (JWKS). Self-hosting Zitadel on ACA has specific requirements (Login V2 as its own container + path routing, `http2` ingress, external-TLS mode) — see spec §5.6 before touching deploy.
- **DB migrations run as a deployment pipeline step** (`alembic upgrade head` from `clothesline_db`), ordered before the API's new revision goes live — not as a standing ACA job (spec §11.2).
- Keep product decisions in `business/`, technical decisions in `specs/`. Update the spec when the design changes.
