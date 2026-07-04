# Implementation Plan — Clothesline (Phase 1: MVP)

> **Companion to:** [`technical-implementation-spec.md`](./technical-implementation-spec.md)
> **Phase:** 1 of 3 (MVP)
> **Document date:** 3 July 2026
> **Status:** Draft for build
> **Audience:** the person(s) building the MVP. This turns the spec's *design* into an *ordered build plan* — milestones, tasks, dependencies, and acceptance criteria. It does not restate the design; cross-references point back to spec sections (e.g. "spec §5.2").

---

## 1. Approach

Build **thin, end-to-end, and offline-critical-path first.** The riskiest, most differentiating requirement is *offline-first at the counter* (spec §7), so the plan front-loads the walking skeleton (Aspire graph + one real request/response) and the core load lifecycle **before** polish (photos, auth email delivery, deploy hardening).

Sequencing principles:
- **Skeleton before features** — get `aspire run` booting both containers + Postgres/Azurite on day one.
- **Vertical slices** — each milestone delivers a demoable user-visible capability, not a horizontal layer.
- **Offline is not a "phase at the end"** — the client is built local-first from M3 onward; the sync endpoint lands as soon as there's state to sync.
- **Tests ride with the code** — pytest/Vitest per milestone; Playwright e2e (incl. the offline flow) gates the milestones that complete a user journey.

Effort tags are **T-shirt sizes** (S/M/L), not calendar estimates — this is a solo pre-launch build (PRD §6).

---

## 2. Milestones at a glance

| # | Milestone | Delivers | Depends on |
|---|---|---|---|
| M0 | Repo & toolchain | Dev container + repo scaffolding, CI skeleton | — |
| M1 | Aspire walking skeleton | `aspire run` boots web + api + Postgres + Azurite + Zitadel core + Login V2; one live `/health` round-trip | M0 |
| M2 | Data model & migrations | `clothesline_db` (SQLAlchemy models + Alembic); empty domain modules | M1 |
| M3 | Load lifecycle (online) | Create → itemize → send → receive/reconcile via API + basic UI | M2 |
| M4 | Offline-first & sync | IndexedDB local store, service worker, `/sync`, mutation outbox | M3 |
| M5 | Integrate Zitadel (passwordless) | OIDC/PKCE to Login V2, JWKS validation, minimal user upsert, Mailpit locally | M2 |
| M6 | Photos | Bundle + per-category photos, pre-signed Blob upload, offline capture | M3 |
| M7 | Duplicate & polish | Duplicate flow, counter UX targets, empty/error states | M3 |
| M8 | E2E hardening & deploy | Full Playwright suite (incl. offline) + `azd up` to ACA | M4, M5, M6, M7 |

### Dependency graph

```mermaid
flowchart LR
    M0["M0 · Repo & toolchain"] --> M1["M1 · Aspire skeleton"]
    M1 --> M2["M2 · Data model & migrations"]
    M2 --> M3["M3 · Load lifecycle (online)"]
    M2 --> M5["M5 · Integrate Zitadel"]
    M3 --> M4["M4 · Offline-first & sync"]
    M3 --> M6["M6 · Photos"]
    M3 --> M7["M7 · Duplicate & polish"]
    M4 --> M8["M8 · E2E hardening & deploy"]
    M5 --> M8
    M6 --> M8
    M7 --> M8
```

---

## 3. Milestones in detail

### M0 — Repo & toolchain  ·  size **S**
Foundation so every later milestone builds/tests uniformly.

- [ ] Confirm dev container boots (`.devcontainer/`): Python 3.12 + `uv`, Node LTS, .NET SDK + Aspire workload, docker-in-docker.
- [ ] Scaffold folder structure per spec §3: `aspire/Clothesline.AppHost`, `src/backend/clothesline_db`, `src/backend/clothesline_api`, `src/backend/clothesline_tests`, `src/frontend/clothesline-web`, `src/frontend/clothesline-e2e`.
- [ ] Backend `pyproject.toml` managed by `uv`; add ruff + mypy + pytest.
- [ ] Frontend `clothesline-web` via Vite (React + TS); add eslint + prettier + Vitest.
- [ ] CI skeleton: lint + typecheck + (empty) test jobs for both stacks.

**Acceptance:** fresh clone → open dev container → `uv run pytest` and `npm run test` both run (zero tests) green; CI passes on push.

---

### M1 — Aspire walking skeleton  ·  size **M**
The single most important early milestone: prove the topology (spec §2.1), including the polyglot + prebuilt-image wiring.

- [ ] Aspire AppHost declares: `clothesline-api` (Python/FastAPI), `clothesline-web` (Vite), a **Postgres** resource (app + zitadel databases), **Azurite** (Blob emulator), **Zitadel core** + **Login V2** (prebuilt images, plain-HTTP dev mode), and **Mailpit** (OTP sink).
- [ ] AppHost wires connection strings, the OIDC issuer/JWKS URL, and service discovery into the apps via env vars (no hand-maintained config).
- [ ] FastAPI `GET /health` returning `{status:"ok"}` + DB ping.
- [ ] React app fetches `/health` and renders the status → proves web ↔ api ingress + CORS.
- [ ] Multi-stage Dockerfiles for `clothesline-api` and `clothesline-web` (spec §11.5).

**Acceptance:** `aspire run` boots the full graph; dashboard shows all resources healthy (incl. Zitadel core + Login V2); the web app displays the live API health status.

---

### M2 — Data model & migrations (`clothesline_db`)  ·  size **M**
Persistence for the domain, in the shared data package (spec §3, §4, §5.1).

- [ ] Create the **`clothesline_db`** package (uv workspace member): SQLAlchemy 2.x async models `User {id, sub, email}`, `Load`, `LoadItemCategory` (with `count_mode`), `LoadItem`, `Photo`, `PhotoLink` (spec §4.1), with `updated_at`/`deleted_at` for sync.
- [ ] `PhotoLink` polymorphic junction (`entity_type`/`entity_id`, `is_primary`) with unique `(photo_id, entity_type, entity_id)` + lookup `(entity_type, entity_id)` indexes (spec §4.1).
- [ ] Alembic migration project **inside `clothesline_db`**; initial migration creates the schema. (Execution is a pipeline step, not an ACA job — spec §11.2.)
- [ ] Client-generated UUID PKs accepted on write (spec §7).
- [ ] Static category catalog (spec §4.3) shared as config on server (validation) and client (offline seed).
- [ ] Empty domain packages stubbed in `clothesline_api`: `auth/`, `loads/`, `media/`, `sync/` (spec §5.1), each with `router/service/schemas` importing models from `clothesline_db`.
- [ ] pytest: a throwaway-Postgres fixture whose schema is built by running the `clothesline_db` migrations (exercises the real Alembic path).

**Acceptance:** `alembic upgrade head` from `clothesline_db` builds the schema; a round-trip integration test inserts and reads back a `Load` with items via the session layer.

---

### M3 — Load lifecycle, online  ·  size **L**
The core user journey end-to-end, network-connected (PRD §4.2–4.8; spec §5.2, §5.4).

Backend:
- [ ] `POST /loads` — creates the load with `name` defaulting to today's date, optional shop fields, and **pre-seeded template `LoadItemCategory` rows** (spec §4.3); `GET /loads`, `GET /loads/{id}`, `PATCH /loads/{id}` (draft edits, incl. add/remove categories).
- [ ] `POST /loads/{id}/send` — freezes `total_sent`, `draft → sent`, sent manifest read-only (spec §4.2).
- [ ] `POST /loads/{id}/receive` — **enter or skip**: match → `closed`; mismatch or **skip** → per-category check (spec §5.4), incl. **surplus** (received > sent, PRD §7.4).
- [ ] `POST /loads/{id}/reconcile` — per-category `count_received` check-off (sent tally read-only); closes load.
- [ ] All queries scoped to `user_id` (use a stub user until M5).
- [ ] `LoadItemCategory` count in **manual mode** via tap/number entry; first manual interaction flips `count_mode = manual` permanently (spec §4.4). (Auto/photo-driven mode lands in M6.)

Frontend:
- [ ] Home / load list; create-load screen (**H1 load name → optional shop fields → category list**); **add custom category** free-text + remove-category; **tap-counter** grid (spec §6.2).
- [ ] Load detail + "Mark sent"; receive screen (number **or Skip**) → match celebration / mismatch|skip check.
- [ ] Category check-off screen with **receive-side add/minus counter** (shared by mismatch, skip, and optional home double-check on sent/closed loads).

Tests:
- [ ] pytest for the reconcile/send/duplicate service logic (match, mismatch, **skip→check**, surplus, freeze-on-send, name-resets-on-duplicate) and manual `count_mode` takeover.
- [ ] Vitest for tap-counter increment/decrement + running total, custom-category add/remove, and the mismatch/skip → check branch.

**Acceptance:** online, a user can create (date-named, pre-seeded categories, add a custom one) → itemize → send → receive a matched load (closes), a mismatched load (check → closes), and a skipped-total load (check → closes); Playwright smoke covers them.

---

### M4 — Offline-first & sync  ·  size **L**
Make the M3 journey work with no network (spec §6.4, §7). **Highest-risk milestone.**

- [ ] IndexedDB store (via `idb`/Dexie) as the client system of record; all M3 mutations write locally first.
- [ ] Service worker via `vite-plugin-pwa` (Workbox): precache app shell + category catalog; installable manifest.
- [ ] Mutation **outbox** queue with client-generated UUIDs; sync indicator (non-blocking).
- [ ] Backend `POST /sync`: idempotent upsert-by-id push + changes-since-cursor pull; last-writer-wins by `updated_at` (spec §7).
- [ ] Reconnect handler flushes the outbox and pulls server changes; monotonic status transitions never regress.

Tests:
- [ ] Vitest against fake-IndexedDB for outbox + merge/LWW logic.
- [ ] pytest for `/sync` idempotency (replay the same op → no duplicate/drift).

**Acceptance:** with the network fully offline, create → itemize → send → receive completes; on reconnect the load appears server-side exactly once. (Playwright offline test added in M8.)

---

### M5 — Integrate Zitadel (passwordless)  ·  size **M**
Replace the stub user with real sign-in delegated to Zitadel (PRD §4.1; spec §5.5–5.6). No auth UI or token issuance is built by us.

- [ ] Configure the Zitadel instance: a passwordless project with **email-OTP as the primary factor** and **JIT user creation** (no signup); Login V2 enabled (`LOGINV2_REQUIRED`).
- [ ] Frontend: **OIDC Authorization Code + PKCE** client that redirects to **Login V2** for the email-code exchange, handles the callback, and persists tokens to survive offline (spec §9 tradeoff).
- [ ] Backend `auth/`: **JWKS validation middleware** (issuer + audience checks) on every request; `GET /auth/me` returns the current user.
- [ ] Minimal **user upsert** — on first authenticated request, upsert `User {id, sub, email}` from token claims; scope all load queries to that user.
- [ ] Mailpit wired via Aspire locally so Zitadel's OTP emails are captured (no real mail).

Tests:
- [ ] pytest for JWKS validation (valid/expired/wrong-audience) against a **mock OIDC issuer**, and for the first-request user upsert (spec §10.1).

**Acceptance:** a user signs in email-only via Login V2 (OTP read from Mailpit); authenticated requests are scoped to their own loads; no password anywhere in the flow.

---

### M6 — Photos, per-item groundwork & gallery  ·  size **M**
Optional evidence capture + the `Photo`/`PhotoLink`/`LoadItem` groundwork (PRD §4.5; spec §4.1, §4.4, §8).

- [ ] `POST /loads/{id}/photos` (`{entity_type, entity_id}`) → creates `Photo` + `PhotoLink`, returns pre-signed Blob **upload** URL; `GET /loads/{id}/photos` gallery list; `GET …/{pid}` read SAS; `DELETE …/{pid}` soft-deletes photo + links.
- [ ] Category photo **auto-creates a `LoadItem`** (name = category) and links it; **auto-mode count** increments on add / decrements on delete (floor 0), never once the category is manual (spec §4.4).
- [ ] Client compresses to WebP, uploads bytes directly to Blob (Azurite locally); **one photo per entity** enforced app-side (junction stays M:N-capable).
- [ ] Load thumbnail = the `is_primary` load-linked photo; **Gallery screen** lists all item photos for a load (spec §6.2).
- [ ] Offline capture: store bytes in IndexedDB with `local_only`; `Photo` + `PhotoLink` + auto-created `LoadItem` ride `/sync`, bytes go out-of-band on reconnect.

**Acceptance:** attach a bundle + a category photo online and offline-then-synced; the category photo creates a `LoadItem`, bumps the auto count (and delete decrements it), appears in the gallery; the `is_primary` photo renders as the load thumbnail; blobs are SAS-gated (not public).

---

### M7 — Duplicate & polish  ·  size **S–M**
The "template" mechanic + hitting the usability targets (PRD §4.4; spec §5.3, §6.3).

- [ ] Duplicate action (home list ⋮ + open load): new `draft` carrying **categories only** (template + custom); `name` reset to the new date, counts/photos/shop/location/`count_mode` reset (spec §5.3). Works offline client-side; `/duplicate` endpoint for the online/cross-device path.
- [ ] Counter UX pass: large thumb-reachable tiles, single-tap increment with feedback, always-visible running total (PRD < 60s target).
- [ ] Empty states, error/toast states, sync-status affordance, install prompt.

**Acceptance:** duplicating a load reproduces its category set and nothing else; a stopwatch test of create → itemize (6–10 items) → mark sent lands under the PRD's 60s target.

---

### M8 — E2E hardening & deploy  ·  size **M**
Prove the whole thing and ship it (spec §10.3, §11).

- [ ] Playwright e2e (`clothesline-e2e`) against the Aspire graph (incl. real Zitadel core + Login V2), using pre-installed Chromium at `/opt/pw-browsers/chromium` (no `playwright install`):
  - passwordless sign-in via Login V2 (OTP from Mailpit)
  - create → itemize → send → receive **match**
  - create → send → receive **mismatch** → check-off → close
  - **offline** create+itemize+send+receive → reconnect → assert single server-side load
  - duplicate (categories only) and photo attach (bundle + category via Azurite) → auto-creates a `LoadItem`, bumps the auto count, shows in the gallery
- [ ] CI gate wired in order: lint/typecheck → pytest → Vitest → build containers → Playwright (spec §10.4).
- [ ] **App-DB migration as a CI/CD step** (`alembic upgrade head` from `clothesline_db`), ordered before the api revision goes live (spec §11.2).
- [ ] `azd up` — provision the **two ACA environments** (identity + application, spec §2.2): app env (web, api, Postgres #2, Blob) and identity env (Zitadel core + Login V2, App Gateway/Front Door path routing, Postgres #1); secrets via Key Vault.
- [ ] Apply the **Zitadel-on-ACA checklist** (spec §5.6 / §11.3): `transport: http2`, external-TLS mode, masterkey + login-client PAT, `sslmode=require`, custom domain, `minReplicas: 1`.
- [ ] Smoke the deployed environments; confirm HTTPS ingress, Login V2 sign-in, and the PWA installs on a phone.

**Acceptance:** full Playwright suite green in CI; `azd up` yields a live two-environment ACA deployment where a phone can sign in via Login V2, install the PWA, and complete the counter flow end-to-end.

---

## 4. Cross-cutting workstreams

Run alongside the milestones rather than as discrete steps:

- **Testing** — pytest + Vitest land with each milestone; Playwright grows through M8 (spec §10).
- **CI/CD** — skeleton in M0, gate assembled in M8; keep it green throughout.
- **Security** — identity delegated to Zitadel (no auth logic of our own), JWKS-validated requests, user-scoped queries, minimal PII (email only), SAS-gated photos, secrets via Key Vault (spec §9). Verify per relevant milestone, not bolted on at the end.
- **Observability** — lean on the Aspire dashboard (logs/traces/metrics) locally from M1; wire ACA logging at deploy.

---

## 5. Risks & mitigations

```mermaid
flowchart TB
    r1["Offline sync correctness<br/>(dup records, lost writes)"] --> m1["Client-gen UUIDs +<br/>idempotent /sync +<br/>M4 fake-IndexedDB tests"]
    r2["Counter too slow<br/>(&gt; 60s kills the premise)"] --> m2["Single-screen tap counter,<br/>stopwatch acceptance in M7"]
    r3["Aspire polyglot wiring<br/>(Python/Vite as Aspire resources)"] --> m3["De-risk in M1 skeleton<br/>before any feature work"]
    r4["Photo storage cost/leak"] --> m4["Client WebP compression +<br/>SAS-gated private blobs (M6)"]
    r5["ACA deploy drift"] --> m5["Single source of truth in<br/>Aspire model; azd up (M8)"]
    r6["Zitadel on ACA<br/>(http2 ingress + Login V2 routing)"] --> m6["De-risk in M1 skeleton;<br/>document reqs in spec §5.6"]
```

| Risk | Likelihood | Mitigation |
|---|---|---|
| Offline sync produces duplicates / lost updates | Med | Client-generated UUIDs; idempotent upsert-by-id `/sync`; LWW is safe because Phase 1 is single-user (spec §7); dedicated M4 tests |
| Aspire polyglot orchestration friction | Med | Prove it in the M1 skeleton before building features; keep Dockerfiles simple |
| Zitadel self-host on ACA (http2 ingress, Login V2 single-origin routing, setup/masterkey) | Med | Stand Zitadel up in the M1 skeleton; requirements + sources captured in spec §5.6; App Gateway/Front Door for path routing |
| Itemize flow misses the < 60s target | Med | Single-screen counter (spec §6.3); stopwatch acceptance check in M7 |
| Photo storage cost / accidental public exposure | Low | Compress client-side; private container + short-lived SAS only (spec §8) |
| Scope creep from PRD open questions | Med | Decisions already fixed in spec §14; treat changes as explicit re-scoping |

---

## 6. Definition of Done (Phase 1)

The MVP is done when:
1. A phone-installed PWA completes **create → itemize → send → receive** for both matched and mismatched loads — **fully offline** — and syncs on reconnect.
2. Passwordless, email-only sign-in works end-to-end via Zitadel Login V2 (no password, no signup step).
3. Duplicate, photos (bundle + per-category), and optional home reconcile all function.
4. The full Playwright suite (including the offline path) is green in CI.
5. `azd up` deploys the two ACA environments (identity + application) and the deployed app passes a phone smoke test.
6. The PRD usability targets (spec §13 / PRD §6) are met on a real device: itemize < 60s, matched reconcile < 30s, mismatched reconcile < 90s.
