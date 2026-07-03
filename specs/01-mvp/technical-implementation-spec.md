# Technical Implementation Spec — Clothesline (Phase 1: MVP)

> **Companion to:** [`business/07-prd-phase1-mvp.md`](../../business/07-prd-phase1-mvp.md)
> **Phase:** 1 of 3 (MVP)
> **Document date:** 3 July 2026
> **Status:** Draft for build
> **Scope:** This document describes *how* the Phase 1 MVP is built. It maps every PRD feature to a concrete technical design. It does **not** re-argue product decisions — see the PRD for the *what* and *why*.

---

## 1. Summary

Clothesline MVP is an **offline-first Progressive Web App** backed by a **Python FastAPI** service. The two run as separate containers, orchestrated in development and provisioned for the cloud by **Aspire (aspire.dev)**, and deployed as **Docker containers to Azure Container Apps (ACA)**.

The defining technical constraint from the PRD is **offline-first at the counter**: create-load, itemize, mark-sent, and enter-received-count must all work with no network. This drives an architecture where the **client is the primary system of record during a session** (local IndexedDB store), and the backend is a **sync target + durable store + auth + photo storage**, not a hard dependency for the core flow.

| Concern | Choice |
|---|---|
| Orchestration / infra | Aspire (aspire.dev) AppHost |
| Deploy target | Azure Container Apps (Docker containers) |
| Backend | Python 3.12, FastAPI, `uv` (deps + packaging) |
| Backend data | PostgreSQL (SQLAlchemy 2.x + Alembic) |
| Photo storage | Azure Blob Storage (Azurite locally) |
| Frontend | React + Vite, TypeScript, PWA (service worker + IndexedDB) |
| Auth | Passwordless email (magic link / OTP), JWT session |
| Backend tests | pytest |
| Frontend unit tests | Vitest |
| E2E tests | Playwright |
| Local dev | Dev Container + Aspire AppHost |

---

## 2. Architecture

### 2.1 Component view

```
                         ┌──────────────────────────────────────────┐
                         │        Aspire AppHost (aspire.dev)         │
                         │  local orchestration + azd provisioning    │
                         └──────────────────────────────────────────┘
                                          │ describes / wires
        ┌─────────────────────────────────┼──────────────────────────────────┐
        ▼                                 ▼                                    ▼
┌────────────────┐              ┌────────────────────┐              ┌────────────────────┐
│  Frontend PWA  │  HTTPS/JSON  │   Backend API      │   TCP        │   PostgreSQL       │
│  React + Vite  │ ───────────► │   FastAPI (uv)     │ ───────────► │   (loads, users)   │
│  service worker│ ◄─────────── │   /api/v1/*        │              └────────────────────┘
│  IndexedDB     │   sync       │                    │   HTTPS
└────────────────┘              │                    │ ───────────► ┌────────────────────┐
        ▲                       └────────────────────┘              │  Blob Storage      │
        │ installable / offline           │                        │  (photos)          │
        │                                  │ email                  └────────────────────┘
   user's phone                            ▼
                                 ┌────────────────────┐
                                 │  Email provider    │
                                 │  (magic link/OTP)  │
                                 └────────────────────┘
```

### 2.2 Runtime containers (Azure Container Apps)

Two application containers plus managed backing services:

1. **`clothesline-web`** — Nginx serving the built Vite/React static bundle + PWA service worker. Ingress: external, HTTPS.
2. **`clothesline-api`** — FastAPI (Uvicorn/Gunicorn) container. Ingress: external (called by the PWA), HTTPS.

Backing services (provisioned by Aspire, not app containers):
- **Azure Database for PostgreSQL – Flexible Server** (or a Postgres container in ACA for the cheapest MVP footprint — see §11.2).
- **Azure Blob Storage** account/container for photos.

> The frontend is a static bundle and *could* be hosted on Azure Static Web Apps or a CDN, but the PRD/stack calls for Docker-in-ACA uniformity, so it ships as a container behind ACA ingress. Revisit if cost/latency argues otherwise.

### 2.3 Aspire's role (aspire.dev)

The **Aspire AppHost** is the single source of truth for the topology. It:
- Declares the two app containers and their backing resources (Postgres, Blob/Azurite).
- Wires **connection strings and service discovery** into each container via environment variables — no hand-maintained config duplication.
- Runs the whole graph locally with one command (`aspire run`), giving a dashboard with logs, traces, and metrics across services.
- Feeds `azd` (Azure Developer CLI) to **provision + deploy** the same graph to Azure Container Apps (`azd up`).

Aspire is polyglot here: the AppHost is .NET, but the orchestrated resources are the **Python FastAPI** service and the **Vite/React** app (added as executable/container resources with Dockerfiles). See `CLAUDE.md` for how this sits at the repo root.

---

## 3. Repository & folder structure

```
/                              repo root
├── CLAUDE.md                  agent/dev guide (Aspire, dev container, structure)
├── .devcontainer/             dev container definition
├── aspire/
│   └── Clothesline.AppHost/   Aspire AppHost project (topology + azd target)
├── specs/
│   └── 01-mvp/                this spec
└── src/
    ├── backend/
    │   ├── clothesline_api/    FastAPI app (backend module)
    │   └── clothesline_tests/  pytest unit/integration tests
    └── frontend/
        ├── clothesline-web/    Vite + React PWA (frontend module)
        └── clothesline-e2e/    Playwright e2e tests
```

Notes:
- **Backend module** (`clothesline_api`) is a modular monolith — one deployable, internally split by domain package (§5.1). `uv` manages its dependencies and packaging via `pyproject.toml`.
- **Backend unit test project** (`clothesline_tests`) holds pytest suites; unit tests run against the domain/service layer, integration tests against a throwaway Postgres.
- **Frontend module** (`clothesline-web`) is the Vite/React PWA; **Vitest** unit tests live inside it, colocated with components.
- **Playwright e2e** (`clothesline-e2e`) is its own project so it can drive the built PWA (including offline flows) independently of the unit test runner.

---

## 4. Data model

The same logical model exists on the client (IndexedDB) and server (Postgres). The client is authoritative during an offline session; the server is authoritative once synced.

### 4.1 Entities

**User**
| field | type | notes |
|---|---|---|
| id | uuid | pk |
| email | text | unique, lowercased |
| created_at | timestamptz | |

**Load** — the core record (PRD §3.2, §3.6, §3.7)
| field | type | notes |
|---|---|---|
| id | uuid | pk, **client-generated** (uuid v4) so offline creates are stable across sync |
| user_id | uuid | fk |
| shop_name | text | |
| shop_location | text | free text in MVP |
| send_date | date | |
| status | enum | `draft` \| `sent` \| `closed` |
| total_sent | int | denormalized sum of item counts, frozen at "send" |
| total_received | int? | entered at counter |
| bundle_photo_id | uuid? | fk → Photo, the load thumbnail |
| reconciled | bool | true once category check-off completed (optional) |
| created_at / updated_at | timestamptz | `updated_at` drives sync conflict resolution |
| deleted_at | timestamptz? | soft delete for sync |

**LoadItem** — one row per category present on a load (PRD §3.3)
| field | type | notes |
|---|---|---|
| id | uuid | pk, client-generated |
| load_id | uuid | fk |
| category | text | from the category catalog (§4.3) |
| count_sent | int | the tap-counter value at send |
| count_received | int? | filled only during a mismatch check-off |
| photo_id | uuid? | optional per-category photo |

**Photo** (PRD §3.5)
| field | type | notes |
|---|---|---|
| id | uuid | pk, client-generated |
| load_id | uuid | fk |
| kind | enum | `bundle` \| `category` |
| blob_key | text | key in Blob Storage; null until upload completes |
| local_only | bool | client-side flag: captured offline, not yet uploaded |
| content_type | text | e.g. image/webp |

### 4.2 Load state machine

```
create ──► draft ──(mark sent)──► sent ──(enter received count)──► closed
                                    │
                                    └─ match  → close immediately
                                    └─ mismatch → item check-off → close
```
- `total_sent` is frozen when the load transitions `draft → sent` (PRD §3.6: manifest becomes the source of truth).
- Optional home reconcile (PRD §3.8) can set `reconciled = true` on an already-`closed` load without changing status.
- **Open question O2 in PRD** (is `draft` needed?) is resolved here in favor of an explicit `draft` state — it makes offline create/edit and "duplicate" natural, and costs nothing.

### 4.3 Category catalog

MVP ships a **fixed default category list** (PRD open question O1), bundled with the client so it works fully offline:

```
Shirts, Trousers, Shorts, Underwear, Socks, Towels, Bedsheets, Jackets, Dresses, Other
```

- Stored as a static config on the client; the server keeps the same list for validation.
- **Custom categories are out of scope for Phase 1** (deferring O1's second half). Revisit if user testing shows the fixed list is a blocker.

---

## 5. Backend design (`src/backend/clothesline_api`)

### 5.1 Internal structure (modular monolith)

```
clothesline_api/
├── main.py               FastAPI app factory, router mounting, middleware
├── config.py             settings from env (Aspire-injected)
├── db.py                 SQLAlchemy engine/session, async
├── auth/                 passwordless email auth + JWT
├── loads/                loads + load items + reconcile (core domain)
├── media/                photo upload URLs + blob integration
├── sync/                 batch pull/push sync endpoint
└── common/               errors, pagination, dependencies
```

Each domain package holds `router.py` (HTTP), `service.py` (business logic), `models.py` (SQLAlchemy), `schemas.py` (Pydantic). Services are unit-testable without HTTP.

### 5.2 API surface (`/api/v1`)

All endpoints require a valid session JWT except the auth start/verify pair.

**Auth (PRD §3.1)**
| method | path | purpose |
|---|---|---|
| POST | `/auth/start` | body `{email}` → issues OTP + magic link, emails it. Always 200 (no account enumeration). |
| POST | `/auth/verify` | body `{email, code}` **or** `{token}` → returns session JWT (+ refresh). Creates the user on first verify. |
| GET | `/auth/me` | current user. |

**Loads (PRD §3.2–3.8)**
| method | path | purpose |
|---|---|---|
| GET | `/loads` | list current user's loads (home screen). |
| POST | `/loads` | create a load (accepts client-generated id, categories, counts). |
| GET | `/loads/{id}` | full load with items + photos. |
| PATCH | `/loads/{id}` | edit header / item counts while `draft`. |
| POST | `/loads/{id}/send` | freeze manifest, `draft → sent`. |
| POST | `/loads/{id}/receive` | body `{total_received}` → returns `match` or `mismatch`; on match sets `closed`. |
| POST | `/loads/{id}/reconcile` | submit per-category `count_received` check-off; closes load (mismatch path) or records optional home reconcile. |
| POST | `/loads/{id}/duplicate` | server-side duplicate (carries categories only; see §5.3). |
| DELETE | `/loads/{id}` | soft delete. |

**Media (PRD §3.5)**
| method | path | purpose |
|---|---|---|
| POST | `/loads/{id}/photos` | register a photo, returns a **pre-signed Blob upload URL**; client uploads bytes directly to Blob. |
| GET | `/loads/{id}/photos/{pid}` | returns a short-lived read SAS URL. |

**Sync (offline, §7)**
| method | path | purpose |
|---|---|---|
| POST | `/sync` | batch: client pushes local mutations since `cursor` and pulls server changes since `cursor`. Returns new cursor. |

### 5.3 Duplicate semantics (PRD §3.4)

Duplicating produces a **new `draft` load** that copies only the **set of categories** present on the source (i.e. `LoadItem.category` values). Everything else resets:
- new `id`, new `created_at`
- `shop_name`, `shop_location`, `send_date` cleared
- all `count_sent` / `count_received` = 0
- **no photos copied**, `bundle_photo_id` null

Because a duplicate is just a normal `draft` load, duplication can be performed **entirely client-side offline** (create a new local load pre-seeded with the source's categories); the `/duplicate` endpoint exists mainly for the online path and cross-device parity.

### 5.4 Reconcile logic (PRD §3.7)

`POST /receive` with `total_received`:
- `total_received == total_sent` → status `closed`, response `{result: "match"}`.
- `total_received != total_sent` → status stays `sent`, response `{result: "mismatch", delta}`; client immediately opens the category check-off UI.

Check-off submitted via `/reconcile` with per-category `count_received`; server stores the values and sets status `closed`. **Received-more-than-sent (PRD open question O4)** is handled by allowing `count_received > count_sent` per category and a positive `delta`; the UI labels it as a surplus rather than a shortfall. No blocking validation either way — the tool records reality, it doesn't police it.

### 5.5 Auth details

- **Passwordless**: `/auth/start` generates a 6-digit OTP and an equivalent signed magic-link token, both short-TTL (e.g. 10 min), single-use, stored hashed. Email sent via a provider (Azure Communication Services Email, or a transactional provider such as Resend). Locally, a **Mailpit/log sink** captures emails so no real mail is sent (§10.3).
- **Session**: short-lived access JWT (~15 min) + longer refresh token. Tokens signed with a secret injected by Aspire (Key Vault in Azure). The PWA stores tokens to survive offline sessions (PRD §3.1: zero re-auth friction) — kept in IndexedDB/`localStorage` with the tradeoff noted in §9.
- No password, no recovery flow (PRD §3.1).

---

## 6. Frontend design (`src/frontend/clothesline-web`)

### 6.1 Stack

- **Vite + React + TypeScript**.
- **PWA**: `vite-plugin-pwa` (Workbox) for the service worker + web app manifest → installable, offline app shell.
- **Local store**: IndexedDB via a thin wrapper (e.g. `idb`/Dexie) — the offline system of record.
- **Server state / sync**: a query layer (e.g. TanStack Query) that reads/writes IndexedDB first and reconciles with `/sync` in the background.
- **Routing**: React Router.
- **Styling**: mobile-first; large tap targets for the counter (see §6.3).

### 6.2 Screens

| Screen | PRD ref | Notes |
|---|---|---|
| Sign in | §3.1 | email input → "check your email"; deep-link handler for magic link. |
| Home / load list | §3.2 | list of loads with bundle-photo thumbnail + status chip; "New load" and per-load "⋮ → Duplicate". |
| Create / edit load | §3.2–3.3 | shop, location, date + the tap-counter grid. |
| Tap counter | §3.3 | category grid; each tile increments on tap; running total pinned. |
| Load detail | §3.6 | manifest summary; "Mark sent". |
| Receive | §3.7 | single number input → match (celebrate + close) or mismatch → check-off. |
| Category check-off | §3.7/§3.8 | per-category received counts; used for mismatch (required) and home reconcile (optional). |
| Photo capture | §3.5 | camera/file input for bundle + per-category photos. |

### 6.3 Counter UX (the make-or-break number)

PRD success metric is **< 60s to itemize**. Design implications:
- Category tiles are large, thumb-reachable, and increment on a **single tap** with immediate haptic/visual feedback; long-press or a small "−" affordance decrements.
- No modal, no navigation between taps — the whole itemize step is one screen.
- Running total is always visible.

### 6.4 Offline behavior

- Service worker precaches the app shell + category catalog → app opens with no network.
- All mutations (create, itemize, send, receive, reconcile, duplicate) write to IndexedDB synchronously and enqueue a sync op.
- Photos captured offline are stored as blobs in IndexedDB with `local_only = true`, uploaded on reconnect.
- A subtle sync indicator shows pending/failed sync; it never blocks the core flow.

---

## 7. Offline sync strategy

**Model:** offline-first with a queue and last-writer-wins per record, made safe by client-generated ids.

1. **Client-generated UUIDs** for Load / LoadItem / Photo eliminate create-time id collisions — an offline create is a first-class record, not a temp placeholder.
2. **Mutation queue**: each local change appends an op `{entity, id, op, payload, updated_at}` to an outbox in IndexedDB.
3. **Push**: `POST /sync` sends the outbox; server applies ops idempotently (upsert by id).
4. **Pull**: same call returns server changes since the client's `cursor` (a monotonic version/timestamp). Client merges.
5. **Conflict resolution**: **last-writer-wins by `updated_at`** at the record level. This is acceptable for MVP because Phase 1 is **single-user** (PRD out-of-scope: multi-user), so real conflicts are limited to the same user on two devices — rare, and LWW is a reasonable loss function. Sent/closed status transitions are monotonic and never regressed by an older update.
6. **Photos**: uploaded out-of-band to Blob via pre-signed URLs; the `/sync` payload only carries photo metadata + `blob_key`, never bytes.

---

## 8. Photo storage

- Bytes live in **Azure Blob Storage**; the DB stores only `blob_key` + metadata.
- Upload path: client asks API for a **pre-signed (SAS) upload URL** → PUTs bytes directly to Blob → confirms to API. Keeps large payloads off the API container.
- Read path: API returns short-lived read SAS URLs (or proxies) so blobs aren't public.
- Images are compressed client-side (target WebP) before upload to respect mobile data.
- **Local dev** uses **Azurite** (Blob emulator) wired by Aspire, so no cloud account is needed to develop the photo flow.

---

## 9. Security & privacy

- All ingress over HTTPS (ACA-managed certs).
- Auth secrets/JWT signing key + DB/blob connection strings come from **Azure Key Vault**, injected by Aspire/azd; never committed. Locally they come from Aspire/dev-container config.
- `/auth/start` returns 200 regardless of whether the email exists (no account enumeration).
- OTP/magic-link tokens are hashed at rest, single-use, short-TTL.
- Every data query is scoped to the authenticated `user_id` (single-user data isolation).
- **Token-at-rest tradeoff:** to honor "zero re-auth friction" offline, session tokens are persisted client-side. Access tokens are short-lived and refreshed; the refresh token is the sensitive item. Accepted for a single-user consumer MVP; flagged for revisit if the threat model changes.
- Photos are private (SAS-gated), not public URLs.

---

## 10. Testing strategy

### 10.1 Backend unit/integration (`clothesline_tests`, pytest)
- **Unit**: domain services (reconcile match/mismatch/surplus, duplicate semantics, send-freezes-manifest, sync merge/LWW) tested without HTTP.
- **Integration**: FastAPI `TestClient` against a **throwaway Postgres** (testcontainers or the Aspire-provisioned dev DB), covering auth start/verify, the loads lifecycle, and `/sync` idempotency.
- Run via `uv run pytest`.

### 10.2 Frontend unit (Vitest, inside `clothesline-web`)
- Component tests for the tap-counter increment/decrement + running total, load-list rendering, and the mismatch → check-off branch.
- IndexedDB wrapper and outbox/sync-merge logic tested against a fake IndexedDB.

### 10.3 E2E (`clothesline-e2e`, Playwright)
- Full flows against the running Aspire graph:
  - Passwordless sign-in (OTP read from the **Mailpit/log sink**).
  - Create → itemize → send → receive **match** (fast close).
  - Create → send → receive **mismatch** → category check-off → close.
  - Duplicate a load → verify only categories carry over, counts/photos/shop reset.
  - **Offline path**: Playwright toggles offline context, performs create+itemize+send+receive fully offline, then goes online and asserts the load syncs to the API.
  - Photo attach (bundle + per-category) via file input against Azurite.
- Playwright is browser-driven; use the pre-installed Chromium (`/opt/pw-browsers/chromium`) — do not run `playwright install`.

### 10.4 CI gate
Lint + typecheck (ruff/mypy backend, eslint/tsc frontend) → backend pytest → frontend Vitest → build both containers → Playwright e2e against the Aspire graph.

---

## 11. Deployment (Azure Container Apps via Aspire)

### 11.1 Flow
- **Local**: `aspire run` boots the AppHost — Postgres, Azurite, API, and web — with the dashboard for logs/traces.
- **Provision + deploy**: `azd up` reads the Aspire AppHost model and provisions the ACA environment + backing resources, builds each Dockerfile, pushes to Azure Container Registry, and deploys the revisions.
- Config (connection strings, secrets) flows from Aspire resource wiring → ACA env vars / Key Vault references. No manual per-environment config drift.

### 11.2 Backing store choice
- MVP default: **Azure Database for PostgreSQL – Flexible Server** (managed, small SKU). A containerized Postgres in ACA is cheaper but less durable; acceptable only for a throwaway preview environment. Blob Storage is a standard account with one private container for photos.

### 11.3 Containers
- `clothesline-api`: multi-stage Dockerfile using `uv` to install deps into a slim Python 3.12 image; runs Uvicorn behind Gunicorn.
- `clothesline-web`: multi-stage Dockerfile — `node` build stage runs `vite build`, static output served by Nginx; SPA + service-worker friendly (correct cache headers, fallback to `index.html`).

---

## 12. Local development

- Open the repo in the **Dev Container** (`.devcontainer/`) — provides Python 3.12 + `uv`, Node.js, the .NET SDK + Aspire workload, and Docker access.
- One command (`aspire run`) starts the full graph; the PWA hot-reloads via Vite, the API via Uvicorn `--reload`.
- See `CLAUDE.md` at the repo root for the authoritative dev/orchestration notes.

---

## 13. Mapping: PRD feature → implementation

| PRD § | Feature | Where implemented |
|---|---|---|
| 3.1 | Passwordless email auth | `auth/` module; `/auth/start`+`/auth/verify`; Mailpit locally (§5.5) |
| 3.2 | Create a load | `loads/`; `POST /loads`; create/edit screen |
| 3.3 | Itemize tap-counter | `LoadItem`; tap-counter screen (§6.3) |
| 3.4 | Duplicate load | `/duplicate` + client-side duplicate (§5.3) |
| 3.5 | Photos (optional) | `media/`; Blob + Azurite; pre-signed upload (§8) |
| 3.6 | Send | `/loads/{id}/send` freezes `total_sent` (§4.2) |
| 3.7 | Receive & reconcile | `/receive` + `/reconcile`; match/mismatch (§5.4) |
| 3.8 | Home reconcile (optional) | `/reconcile` on closed load; `reconciled` flag |
| 3.9 | Offline-first | PWA service worker + IndexedDB + `/sync` (§6.4, §7) |
| 3.10 | Shop record-keeping | `shop_name`/`shop_location` on `Load`; capture only |

---

## 14. Deferred / open (tracked from PRD §6)

| PRD Q | Decision in this spec |
|---|---|
| O1 default categories | Fixed list of 10 (§4.3); **no custom categories** in Phase 1 |
| O2 draft state | **Yes** — explicit `draft` state (§4.2) |
| O3 data retention | Not implemented in Phase 1; no auto-purge. Flag storage growth for photos — revisit before GA |
| O4 received > sent | Handled as **surplus** (positive delta), no blocking (§5.4) |
| O5 multiple open loads same shop | Allowed; loads are independent records, disambiguated by date + thumbnail in the list |
| O6 reconcile reminder | Out of scope Phase 1 (PRD backlog); no notification infra built |
