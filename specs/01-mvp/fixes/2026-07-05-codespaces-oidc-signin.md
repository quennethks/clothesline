# Post-Fix Report — Sign-in broken under GitHub Codespaces (`aspire run`)

> **Companion to:** [`technical-implementation-spec.md`](../technical-implementation-spec.md) §2.1, §5.5, §5.6 · [`m0-m1-post-implementation-report.md`](../m0-m1-post-implementation-report.md) §5 (carried-forward risk that materialized here)
> **Milestone:** M5 (Zitadel passwordless auth) — local dev follow-up, not a new milestone
> **Document date:** 5 July 2026
> **Status:** Resolved — confirmed working by the user in a live GitHub Codespace
> **Purpose:** Record why sign-in broke, the full diagnostic chain (five distinct, layered bugs), and the resulting permanent change to `apphost.cs`: a local reverse proxy in front of the identity services. Same intent as the M0/M1 report — so this ground isn't re-covered blind later.

---

## 1. Summary

Clicking "Sign in with email" failed immediately with `Failed to fetch`. The root symptom looked like a single bug but was actually **five separate, layered bugs**, each masking the next: fixing one just exposed the next failure further down the OIDC flow. All were found by reproducing the failure directly (`curl`, container logs, Caddy's admin API) rather than guessed from documentation.

**Net result:** two permanent changes to `aspire/Clothesline.AppHost/apphost.cs`:
1. **GitHub Codespaces auto-detection** (`isCodespaces`, a `PublicUrl()` helper) — the OIDC issuer, Zitadel's `ExternalDomain`/`ExternalSecure`/`ExternalPort`, the web app's redirect URIs, `ALLOWED_ORIGINS`, and `VITE_API_BASE_URL` are now derived from the Codespaces forwarded-URL pattern when running in a Codespace, falling back to plain `localhost` otherwise.
2. **A new `identity-proxy` container** (Caddy) fronting Zitadel core and Login V2 under a single origin — see §4 for why this isn't Codespaces-specific and is required for local dev generally.

This confirms the risk flagged in the M0/M1 report §5: *"the browser-facing issuer and the API's internal JWKS fetch URL are deliberately different hostnames... hasn't been proven with real token validation code yet."* It hadn't — this is that proof, and it took a reverse proxy to make true.

---

## 2. Trigger

Not a code regression — the user was running the existing M5 implementation for the first time inside a **GitHub Codespace** rather than a plain local devcontainer. Every bug below stems from that environment's two properties: (a) each port is forwarded to its own HTTPS subdomain rather than being reachable as `localhost`, and (b) forwarded ports are Private by default and some require explicit Host-header trust.

---

## 3. Issues encountered and how each was resolved

### 3.1 OIDC issuer/redirect URIs hardcoded to `localhost`
**Symptom:** `Sign-in error: Failed to fetch`.
**Diagnosis:** `VITE_OIDC_ISSUER` (and Zitadel's `ZITADEL_EXTERNALDOMAIN`/`ZITADEL_EXTERNALSECURE`/`ZITADEL_EXTERNALPORT`, and the web redirect URIs) were all hardcoded to `http://localhost:{port}`. The page itself loads fine because Vite's port is forwarded transparently by VS Code/Codespaces, but `react-oidc-context`'s `signinRedirect()` does a background `fetch()` to the issuer's `.well-known/openid-configuration` — and `localhost:8080` from *inside the browser* resolves to the developer's own machine, not the Codespace.
**Resolution:** Added `isCodespaces`/`codespaceName`/`codespacePortForwardingDomain` detection (from GitHub's own injected env vars — no setup needed, see [`apphost.cs`](../../../aspire/Clothesline.AppHost/apphost.cs)) and a `PublicUrl(port, localScheme)` helper that returns the Codespaces forwarded HTTPS URL when applicable, else falls back to `http://localhost:{port}`. Applied to the issuer, Zitadel's external-domain env vars, the web redirect/post-logout URIs, `ALLOWED_ORIGINS` (API CORS), and `VITE_API_BASE_URL`.

### 3.2 Codespaces blocks background `fetch()` to a Private forwarded port
**Symptom:** Same error persisted after 3.1; DevTools showed the discovery request going to the *correct* forwarded URL but returning `404`.
**Diagnosis:** `docker logs` on the Zitadel container showed **zero** matching requests — the request never reached the container. Codespaces' Private-port auth challenge only completes for top-level browser navigations (where it can redirect through a GitHub login prompt); a background `fetch()` from a different forwarded subdomain just gets bounced with a 404 at GitHub's edge before reaching the container.
**Resolution:** Set the identity port to **Public** visibility in the Ports panel. (This is inherent to Codespaces, not something `apphost.cs` can fix — Zitadel is the one identity-facing port that legitimately needs to be Public, since it serves unauthenticated first-time visitors by design.)

### 3.3 Zitadel redirects to Login V2 via a same-origin relative path
**Symptom:** Discovery + `/oauth/v2/authorize` now succeeded, but the browser was redirected to `https://<zitadel-domain>/ui/v2/login/login?authRequest=...` and got `{"code":5,"message":"Not Found"}` — from Zitadel core itself, not Login V2.
**Diagnosis:** Zitadel's config key `ZITADEL_OIDC_DEFAULTLOGINURLV2` defaults to the *relative* path `/ui/v2/login/login?authRequest=`, which only resolves correctly if Login V2 shares Zitadel core's origin. Locally they're two different ports (8080 vs 3000) — and this is **not** a Codespaces-specific gap: the exact same relative redirect would 404 in a plain local (non-Codespaces) `aspire run` too, since nothing there unifies the two ports either. It's the local-dev mirror of the production requirement already documented in spec §5.6(a) (single-origin path routing via App Gateway/Front Door).
**Resolution (superseded by §4):** Initially patched by pointing `ZITADEL_OIDC_DEFAULTLOGINURLV2`/`LOGOUTURLV2` at Login V2's own forwarded URL directly. Once the reverse proxy (§4) unified both origins, this was changed again to point at the *proxy's* single origin instead.

### 3.4 Login V2's own backend calls to Zitadel hit the same Host-mismatch bug from the *server* side
**Symptom:** Login V2's page loaded (reached the right origin this time) but returned `HTTP 500`.
**Diagnosis:** `docker logs` on the `login-v2` container showed `Error [ConnectError]: unable to set instance using origin &{zitadel.dev.internal:8080 ...}`. Login V2's Next.js backend calls Zitadel's API using Aspire's internal container-network hostname (`zitadel.dev.internal:8080`), and Zitadel's instance-by-domain resolution requires the `Host` header to match `ExternalDomain` exactly — which it never will for a container-network hostname, **regardless of Codespaces**. This is a latent bug that predates this session's Codespaces work entirely; it just hadn't been hit yet because nobody had completed a real sign-in through Login V2's backend before.
**Resolution:** See §4 — routing Login V2's `ZITADEL_API_URL` through the new reverse proxy instead of directly at Zitadel lets the proxy rewrite the Host header on the way through.

---

## 4. Architectural decision: a local `identity-proxy` (Caddy)

Given 3.3 and 3.4 are both instances of the same underlying gap — Zitadel core and Login V2 need a shared origin, a requirement local dev never had until now — the fix was to add a real reverse proxy locally, matching the production architecture (§5.6(a)) instead of patching around it. **Confirmed with the user before implementing** (the alternative — a Codespaces-only patch via Zitadel's Admin API or a Docker DNS-alias trick — was rejected because it wouldn't fix 3.4 for plain local dev and risked needing `system.domain.write` permissions the bootstrap PAT may not have).

**Design** (`ops/identity-proxy/Caddyfile`, wired into `apphost.cs` as a new `caddy:2-alpine` container):
- Single origin, listening on `zitadelPort` (8080) — this is now the *only* thing host-exposed on that port; Zitadel core and Login V2 both dropped their fixed host-port bindings and are reachable only via container network.
- `/ui/v2/login/*` → Login V2.
- everything else → Zitadel core.
- Login V2's own `ZITADEL_API_URL` now points at this proxy instead of Zitadel directly, so its backend calls get the same Host-rewriting as browser traffic.

Two further sub-bugs surfaced while getting this proxy's header rewriting actually correct — both found by hot-reloading test configs into the running container via Caddy's admin API (`POST /load`) rather than restarting the whole Aspire graph each iteration:

### 4.1 `header_up Host <value>` alone doesn't fully override — Caddy also auto-sets `X-Forwarded-Host`
**Symptom:** Discovery still 404'd with `unable to set instance using origin &{localhost:8080 ...}` even after adding `header_up Host {$ZITADEL_HOST_HEADER}` to the proxy's Zitadel route.
**Diagnosis:** Built a throwaway Caddy config proxying to a `respond` block that echoed back `{http.request.host}` and `X-Forwarded-Host` separately — confirmed `Host` *was* correctly overridden, but Caddy auto-populates `X-Forwarded-Host` with the *original* client Host by default, and Zitadel prefers `X-Forwarded-Host` over `Host` when present.
**Resolution:** Added `header_up X-Forwarded-Host {$ZITADEL_HOST_HEADER}` alongside the existing `Host` override.

### 4.2 Login V2 needs explicit `x-zitadel-public-host` / `x-zitadel-instance-host` headers
**Symptom:** After 4.1, Zitadel's own routing succeeded, but Login V2's backend call to it now failed differently: `Instance not found ... Parent=(public domain "localhost" not trusted)`.
**Diagnosis:** Login V2 doesn't derive its own public-facing host from `Host`/`X-Forwarded-Host` at all — Zitadel's docs mention (without giving a concrete example) that a fronting reverse proxy is expected to set `x-zitadel-public-host` and `x-zitadel-instance-host` explicitly; without them Login V2 falls back to a `localhost` default that Zitadel then rejects as untrusted.
**Resolution:** Added both headers (same value as `ZITADEL_HOST_HEADER`, since Login V2 and Zitadel core share one origin here) to the proxy's `/ui/v2/login/*` route.

**Verification:** re-tested against the live containers after each change (not just adapted-config inspection) — final proof was the error changing from a domain-trust rejection to `Auth Request does not exist`, which is the *expected* response for a deliberately-fake test `authRequest` value, confirming instance resolution now succeeds end-to-end for both Zitadel core and Login V2. The user then re-ran a real sign-in and confirmed it works.

---

## 5. Net effect on the AppHost design

- `zitadel` and `login-v2` containers no longer have fixed host ports — only `identity-proxy` does. Only `identity-proxy`'s port needs Codespaces "Public" visibility now (`login-v2`'s old port no longer needs to be forwarded at all).
- `internalJwksUrl` (consumed by the API for JWT validation) now points through `identity-proxy` rather than directly at Zitadel, for the same Host-matching reason as Login V2's traffic.
- `zitadel-oidc-bootstrap` was **deliberately left unchanged** — it already had its own working fix for this exact class of bug (an explicit `Host` header set in its Python `httpx` client), predating this session. Not routed through the new proxy, to avoid touching already-working code.
- `VITE_LOGIN_V2_URL` (frontend env var) is unrelated dead code (confirmed unused in `clothesline-web/src`) and was left as-is; it now points at Login V2's raw container endpoint rather than the proxy, which would be wrong if anything ever starts consuming it.

---

## 6. Carried-forward risks for later milestones

- **Plain local (non-Codespaces) dev was not re-verified end-to-end in this session** — everything above was tested live inside a Codespace. The `identity-proxy` fix (§4) is asserted by code-reading to also fix 3.3/3.4 for a bare local devcontainer run (since those two bugs were never Codespaces-specific), but that path wasn't independently re-run. Worth a quick smoke test outside Codespaces before relying on it.
- **Codespaces port-forwarding can silently lose its registration** after a container restart (observed once mid-session — the forwarded port vanished from the Ports panel and had to be manually re-added via the Command Palette). Not a code bug, but worth knowing if sign-in suddenly regresses after restarting `aspire run` with no code changes — check the Ports panel before assuming a code regression.
- **`ZITADEL_OIDC_DEFAULTLOGINURLV2`/`LOGOUTURLV2` are set explicitly** to the proxy's single origin rather than left at Zitadel's default relative path, even though the default would now coincidentally work — kept explicit so the single-origin design is self-documenting in `apphost.cs` rather than relying on an implicit path-prefix match.
- **M6+ and beyond:** if any new backend-to-Zitadel integration is added (e.g. a future admin tool calling the Management API), remember it will hit the *same* Host-matching requirement as Login V2 did (§3.4) unless routed through `identity-proxy` or given its own explicit Host override like `zitadel-oidc-bootstrap` has.

---

## 7. Sequel — see the 10 July 2026 report

Once M4 replication landed, the browser made its first ever call to the **API**, and the Private-port bug of §3.2 recurred on port 8000 — along with three further defects underneath it (a malformed `OIDC_JWKS_URL`, Zitadel's access tokens carrying no `email` claim, and `X-Forwarded-Proto` being passed through rather than forced). All four are written up in [`2026-07-10-codespaces-sync-error.md`](./2026-07-10-codespaces-sync-error.md), which also supersedes the "only the identity port needs Public visibility" note in §5: the API port now needs no visibility change at all, because its traffic goes same-origin through the Vite dev server.
