# Post-Implementation Report — M0 + M1 (Clothesline Phase 1: MVP)

> **Companion to:** [`implementation-plan.md`](./implementation-plan.md), [`technical-implementation-spec.md`](./technical-implementation-spec.md)
> **Covers:** M0 (Repo & toolchain) and M1 (Aspire walking skeleton)
> **Document date:** 4 July 2026
> **Status:** Complete — verified end-to-end via a live `aspire run`
> **Purpose:** Record what was built, and — in more detail — the real issues hit during the build and how each was diagnosed and resolved, so the same ground isn't re-covered blind in later milestones.

---

## 1. Summary

M0 and M1 were built and verified together in one pass, since M1 (the Aspire walking skeleton) has no foundation to stand on without M0's repo scaffolding. Both milestones are done, tested, and committed (`130443f` on branch `mvp`).

**M0** — folder structure per spec §3; backend `uv` workspace (`clothesline_db`, `clothesline_api`, `clothesline_tests`) with ruff/mypy/pytest all green; frontend Vite + React + TS app with Vitest/typecheck/lint all green; CI workflow (`.github/workflows/ci.yml`); an idempotent dev-container `postCreateCommand` script.

**M1** — an Aspire AppHost (`aspire/Clothesline.AppHost/apphost.cs`) declaring the full local graph: Postgres (two databases), Azurite, Mailpit, Zitadel core + Login V2, the FastAPI backend, and the Vite frontend. Verified live: Zitadel bootstraps and Login V2 reads its machine-user PAT and renders its sign-in UI; FastAPI's `/health` does a real Postgres round-trip; the web app serves; both service Dockerfiles build and smoke-test cleanly.

**Scope decisions made before building** (confirmed with the user):
1. Fold M0's scaffolding into the same pass as M1, since the repo had none of it yet.
2. Stand up Zitadel core + Login V2 + Mailpit as Aspire resources now (per the existing `implementation-plan.md` M1 acceptance criteria), not deferred to M5.
3. Backend stays Python/FastAPI — the user's "prefer C# for Aspire" comment referred to the AppHost project itself (already C#/.NET by design), not a backend rewrite.

---

## 2. What was verified (not just built)

Unlike a plan that's merely "written to match the spec," every piece below was exercised for real before being considered done:

- `uv run pytest` / `ruff check` / `mypy .` — green, backend.
- `npm run test` / `lint` / `typecheck` / `build` — green, frontend.
- A throwaway Zitadel + Postgres bootstrap via raw `docker run` (before touching Aspire) to nail down the exact CLI flags, env vars, and `FirstInstance` config schema empirically rather than from memory.
- A full `aspire run --detach` of the real AppHost, iterated across ~6 failure cycles (see §3) until every resource reached a healthy/running state.
- `curl` round-trips: Zitadel `/debug/healthz` (200), FastAPI `/health` over HTTPS (`{"status":"ok","db":"ok"}` — a genuine DB connection, not a stub), Login V2's `/ui/v2/login` (200, UI renders), the Vite dev server root (200).
- Both Dockerfiles (`clothesline_api`, `clothesline-web`) built with `docker build` and smoke-tested standalone (the API correctly returns a 503 with no DB present; the web image's nginx config correctly serves the SPA fallback for a deep route).
- Test containers, volumes, and stray processes were cleaned up after verification; nothing was left running.

---

## 3. Issues encountered and how each was resolved

This is the part worth reading before touching this AppHost again — each of these cost real iteration time and none were guessable from documentation alone; all were confirmed by reproducing the failure and reading the actual error.

### 3.1 Aspire 13.x scaffolds a *file-based* app, not a `.csproj` project
**Symptom:** `aspire new aspire-empty --language C#` failed outright — `C#` isn't a recognized language value.
**Diagnosis:** `aspire new aspire-empty --help` didn't enumerate valid values; trial of `csharp` (lowercase, no space) succeeded where `C#`, `cs`, and `c#` all failed.
**Resolution:** Use `--language csharp`. The scaffold it produces is also a departure from older Aspire tutorials: a single `apphost.cs` with `#:sdk`/`#:package` top-of-file directives (.NET's "file-based app" feature), not a traditional AppHost `.csproj`. The scaffolded files landed directly in the `--output` directory rather than a nested project folder, so they were manually moved into `aspire/Clothesline.AppHost/` to match the folder layout the spec calls for.

### 3.2 `PasswordParameter`/`UserNameParameter` are `null` unless explicitly supplied
**Symptom:** `builder.AddPostgres("pg")` (no args) compiled fine, but referencing `pg.Resource.PasswordParameter` later (to feed Zitadel's DB env vars) threw a `NullReferenceException` inside Aspire's own `ReferenceExpression` interpolation handler at `aspire run` time — not a compile error.
**Diagnosis:** These properties are only populated when the caller explicitly passes username/password parameters to `AddPostgres(...)`; the zero-arg overload presumably manages credentials internally without exposing them via those properties.
**Resolution:** Create explicit parameters and pass them in: `var pgUser = builder.AddParameter("pg-username", value: "postgres"); var pgPassword = builder.AddParameter(...); var pg = builder.AddPostgres("pg", pgUser, pgPassword);`.

### 3.3 `AddParameter(name, secret: true)` hangs forever non-interactively
**Symptom:** After fixing 3.2, `aspire run --non-interactive` no longer crashed, but silently never progressed — `pg-password` and `zitadel-masterkey` sat in a `ValueMissing` state indefinitely, blocking every downstream resource.
**Diagnosis:** Read every resource's state transitions out of the AppHost's own log file (`~/.aspire/logs/cli_*_detach-child_*.log`) — the bare `AddParameter(name, secret: true)` overload has no default value; it's meant to be filled by an interactive prompt or a previously persisted value, neither of which exists on a first non-interactive run.
**Resolution:** Use the `ParameterDefault`-based overload: `AddParameter(name, new GenerateParameterDefault(), secret: true, persist: true)`. This generates a value and persists it (in `~/.microsoft/usersecrets/...`) so it survives restarts without regenerating.

### 3.4 Zitadel's masterkey must be exactly 32 bytes
**Symptom:** With 3.3 fixed, Zitadel's container now started but exited with `masterkey must be 32 bytes, but is 22`.
**Diagnosis:** `GenerateParameterDefault()`'s default produces a 22-character value; a quick reflection probe (`new GenerateParameterDefault().GetDefaultValue().Length`) confirmed it and found the fix — the class exposes a settable `MinLength` property.
**Resolution:** `new GenerateParameterDefault { MinLength = 32, Special = false }`. Verified by direct instantiation that this always yields exactly 32 characters before wiring it into the graph.
**Gotcha for next time:** because the masterkey parameter is `persist: true`, the first (broken, 22-char) generated value gets written to `usersecrets` and *keeps being reused* across `aspire run`s even after the code is fixed — the stale entry has to be deleted by hand (or the parameter renamed) for a fix to actually take effect.

### 3.5 The Login V2 PAT lives under `Org.LoginClient`, not `Org.Machine` — and needs an explicit output path
**Symptom:** Zitadel's `FirstInstance` bootstrap completed with no errors, but no PAT file ever appeared on the shared volume for Login V2 to read.
**Diagnosis:** Fetched Zitadel's actual default `steps.yaml` from its GitHub repo (pinned to the exact image tag in use) rather than guessing the schema. It shows two *separate* sections: `FirstInstance.Org.Machine` (a general IAM_OWNER service account, alternative to the human admin) and `FirstInstance.Org.LoginClient` (the Login V2 machine user specifically) — the init-steps file had used the wrong one. It also confirmed that PAT/machine-key output paths are opt-in via top-level `FirstInstance.PatPath` / `MachineKeyPath` / `LoginClientPatPath` settings — nothing is written to disk unless one of these is set.
**Resolution:** Moved the machine-user + PAT config to `FirstInstance.Org.LoginClient.{Machine,Pat}` in `ops/zitadel/init-steps.yaml`, and added `ZITADEL_FIRSTINSTANCE_LOGINCLIENTPATPATH=/machinekey/login-client.pat` as an env var on the Zitadel container.

### 3.6 The shared machinekey volume is root-owned; Zitadel runs as non-root
**Symptom:** After fixing 3.5, bootstrap failed with `open /machinekey/login-client.pat: permission denied`.
**Diagnosis:** Docker-created named volumes default to root ownership; the official Zitadel image runs as a non-root user, so it can't write into the volume.
**Resolution:** Added a tiny `alpine` init container (`zitadel-machinekey-init`) whose only job is `chmod 777 /machinekey` on the shared volume, gated with `.WaitForCompletion(machinekeyInit)` on the Zitadel resource — Aspire's idiomatic way to sequence a one-shot setup step ahead of a real resource.

### 3.7 Non-container (executable) endpoints can't have `Port == TargetPort` while proxied
**Symptom:** `aspire run` failed outright with `InvalidOperationException: ... Non-container resources cannot be proxied when both TargetPort and Port are specified with the same value` for `clothesline-api`.
**Diagnosis:** The error message named the exact constraint. `clothesline-api` and `clothesline-web` are host-process ("executable") resources, not containers, and I wanted fixed, predictable ports for both.
**Resolution:** Added `isProxied: false` to both endpoints. This is the correct fix specifically *because* a fixed, non-divergent port is what's wanted here — for containers this constraint doesn't apply (Docker's own port publishing handles it differently), so this only affects the two Python/Node executable resources.

### 3.8 `uv sync` for a workspace member doesn't install that member's own dependencies unless the root project pulls them in
**Symptom:** After all the Zitadel issues were resolved, the API executable failed with `fork/exec .../\.venv/bin/uvicorn: no such file or directory` — twice, at two different paths, before the real cause was clear.
**Diagnosis:** `AddUvicornApp`'s installer step runs a bare `uv sync` (no flags) with `cwd` set to whatever `appDirectory` is configured. Two things had to be reconciled:
  - uv workspaces always share **one** `.venv` at the workspace root, regardless of which directory `uv sync` is run from — so `appDirectory` needed to be `src/backend` (the workspace root), not `src/backend/clothesline_api`, for the resulting `.venv/bin/uvicorn` path to actually exist where Aspire looks for it.
  - But a bare `uv sync` run *from the workspace root* only installs the root pseudo-project's own dependency list — and the root `pyproject.toml` had declared `dependencies = []`. Verified this by literally running `uv sync` by hand from each candidate directory and inspecting `.venv/bin/` afterward.
**Resolution:** Made the root project depend on every workspace member (`clothesline-db`, `clothesline-api`, `clothesline-tests`, all sourced via `{ workspace = true }`). Now a bare `uv sync` from the root pulls in `clothesline_api`'s own dependencies (FastAPI, uvicorn, SQLAlchemy, etc.) transitively, landing them in the one shared venv at the path Aspire expects.

### 3.9 `AddUvicornApp` always launches with an auto-generated dev TLS cert
**Symptom:** Even after 3.8's fix, the API process started successfully, but `curl http://localhost:8000/health` got connection resets (`curl: (52) Empty reply`), and the browser-facing `VITE_API_BASE_URL` (built from `api.GetEndpoint("http")`) would have pointed at the wrong scheme.
**Diagnosis:** The AppHost log showed uvicorn's actual launch args included `--ssl-keyfile ... --ssl-certfile ...` that were never explicitly requested — `AddUvicornApp` unconditionally wires up an auto-generated local dev certificate, independent of whatever endpoint type (`WithHttpEndpoint` vs `WithHttpsEndpoint`) is declared afterward. `curl -k https://localhost:8000/health` confirmed the server really was serving TLS and worked.
**Resolution:** Declared the API's endpoint as `WithHttpsEndpoint(...)` instead of `WithHttpEndpoint(...)`, and updated every `GetEndpoint(...)` reference to the API (just `VITE_API_BASE_URL`) to request `"https"` instead of `"http"`, so the resource model matches what's actually running.

---

## 4. Net effect on the AppHost design

None of the fixes above changed the intended architecture from the technical spec — they're all implementation-level corrections to match the *actual* behavior of Aspire 13.4.6, uv workspaces, and the real Zitadel image, discovered by running things for real rather than trusting assumptions. The final `apphost.cs` carries inline comments at each of these points explaining *why*, so the reasoning isn't lost the next time this file is touched (e.g., for M5's real OIDC/JWT integration, which will build directly on the `OIDC_ISSUER` / `OIDC_JWKS_URL` env vars already wired here).

## 5. Carried-forward risks for later milestones

- **M5 (Zitadel OIDC integration):** the browser-facing issuer (`http://localhost:8080`) and the API's internal JWKS fetch URL (`http://zitadel:8080/oauth/v2/keys`) are deliberately different hostnames. This is expected to work with standard JWT libraries (they validate `iss` and fetch `jwks_uri` independently) but hasn't been proven with real token validation code yet — flag if session/cookie behavior misbehaves.
- **M6 (Photos/Azurite):** the exact non-.NET connection-string shape Aspire injects for the Blob emulator (`ConnectionStrings__blobs`) was not empirically verified in this pass, since nothing consumes it yet — worth a quick spike at the start of M6 rather than assuming the ADO.NET-style parsing used for Postgres applies unchanged.
- **Stale persisted parameters:** any future change to a `persist: true` parameter's generation rules (length, charset) requires manually clearing the old value from `~/.microsoft/usersecrets/<apphost-id>/secrets.json` (or renaming the parameter) — the stale value otherwise silently wins over the new code, exactly as happened in §3.4.
