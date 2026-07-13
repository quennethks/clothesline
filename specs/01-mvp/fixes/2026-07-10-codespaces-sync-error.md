# Post-Fix Report — Permanent "Sync error" badge under GitHub Codespaces (`aspire run`)

> **Companion to:** [`technical-implementation-spec.md`](../technical-implementation-spec.md) §4, §5.5, §5.6 · [`2026-07-05-codespaces-oidc-signin.md`](./2026-07-05-codespaces-oidc-signin.md) (this is the direct sequel — §3.2 and §6 of that report both predicted parts of what follows)
> **Milestone:** M4 (replication) — surfaced once RxDB replication became the first code to make a browser→API call
> **Document date:** 10 July 2026
> **Status:** Resolved — verified end-to-end with a real Zitadel access token driven headlessly through the full OIDC flow
> **Purpose:** Record the four layered bugs behind a single "Sync error" badge, and — just as importantly — record the *diagnostic method* that found them, because reasoning link-by-link about the auth chain produced a confident wrong answer twice before an actual token was minted.

---

## 1. Summary

The app rendered, sign-in succeeded, and the header showed a permanent **"Sync error"**. Nothing synced.

The single symptom was **four separate bugs stacked on top of each other**, each masked by the one in front of it. Only the first is Codespaces-specific; **bugs 2–4 are ordinary defects that would have failed in production too**, and had simply never been exercised because no authenticated API request had ever succeeded in this codebase before M4.

| # | Bug | Layer |
|---|---|---|
| 1 | Cross-origin browser→API `fetch()` blocked by the Codespaces Private-port wall | environment |
| 2 | `OIDC_JWKS_URL` was a C# *type name*, not a URL — API could never fetch signing keys | `apphost.cs` |
| 3 | Zitadel JWT **access tokens carry no `email` claim**, which the API required | backend |
| 4 | `X-Forwarded-Proto` passed through instead of forced — Zitadel resolved an `http` instance and rejected `https`-issued tokens | `identity-proxy` |

**Net changes:** a Vite dev-server proxy (same-origin API calls), a corrected JWKS URL, a userinfo-based `email` resolution path in the API, and a forced `X-Forwarded-Proto` in the Caddyfile. A pre-existing, unrelated breakage of the backend test suite was also repaired (§5).

---

## 2. Trigger

Not a regression. M4's RxDB replication is the **first code in the project to make the browser call the API**. Every layer of the auth chain below the sign-in redirect — JWKS fetch, claim validation, instance resolution — had therefore never actually run against a real token. Four latent defects surfaced at once the moment it did.

The `2026-07-05` report §6 flagged the shape of this: *"Plain local dev was not re-verified end-to-end"* and *"the browser-facing issuer and the API's internal JWKS fetch URL are deliberately different hostnames."* Both mattered here.

---

## 3. Issues encountered and how each was resolved

### 3.1 Codespaces blocks the cross-origin browser→API `fetch()` (Private port)
**Symptom:** "Sync error" badge; no `/sync/*` request ever reached uvicorn.

**Diagnosis:** identical mechanism to the previous report's §3.2, but on the **API** port (8000) rather than the identity port. The PWA at `https://<cs>-5173.app.github.dev` issues a background `fetch()` to `https://<cs>-8000.app.github.dev/sync/{collection}`. Forwarded ports are Private by default, so GitHub's edge intercepts it. Reproduced directly:

```console
$ curl -sD- https://<cs>-8000.app.github.dev/health
HTTP/2 302
location: https://github.dev/pf-signin?...&port=8000...
```

RxDB's handlers throw on any non-2xx ([`pullPushHandlers.ts`](../../../src/frontend/clothesline-web/src/db/pullPushHandlers.ts)), and [`useSyncStatus.ts`](../../../src/frontend/clothesline-web/src/sync/useSyncStatus.ts) sets a **sticky** `hasError` flag that never resets — so one failed request latches the badge for the session. §3.2 fixed this for the identity port by making it Public, but that never covered the API port because no browser→API call existed yet.

**Resolution:** *not* "make port 8000 Public too". Codespaces has **no reliable declarative way** to set port visibility ([community #10394](https://github.com/orgs/community/discussions/10394), [dev-container-spec #5](https://github.com/microsoft/dev-container-spec/issues/5)) — it would be a manual Ports-panel toggle on every new codespace. Instead, route API calls **same-origin through the Vite dev server**, since same-origin fetches from the already-loaded page succeed even on a Private port (which is why the app shell itself loads).

- `clothesline-web/vite.config.ts`: `server.proxy` for `/sync`, `/auth/me`, `/health` → `VITE_DEV_API_TARGET` (`https://localhost:8000`, `secure: false` for uvicorn's self-signed dev cert).
- `apphost.cs`: `VITE_API_BASE_URL=""` so the frontend's existing `?? ''` fallback yields relative paths.

`/auth/me` is proxied **specifically, not `/auth/*`**, so the client-side `/auth/callback` SPA route keeps being served by Vite. Net effect: the API port never needs Public visibility; only the identity port (8080) still does, as before.

### 3.2 `OIDC_JWKS_URL` was the literal string `Aspire.Hosting.ApplicationModel.EndpointReference/oauth/v2/keys`
**Symptom:** with requests now reaching the API, every authenticated call 401'd.

**Diagnosis:** found by dumping the running API process's environment rather than reading the code:

```console
$ tr '\0' '\n' < /proc/$(pgrep -f uvicorn)/environ | grep OIDC_JWKS_URL
OIDC_JWKS_URL=Aspire.Hosting.ApplicationModel.EndpointReference/oauth/v2/keys
```

`apphost.cs` built it as `var internalJwksUrl = $"{identityProxy.GetEndpoint("http")}/oauth/v2/keys";`. Interpolating an `EndpointReference` into a **string `var`** evaluates eagerly and captures `EndpointReference.ToString()` — the type name. The neighbouring lines that *look* identical (`loginV2.WithEnvironment("ZITADEL_API_URL", $"{identityProxy.GetEndpoint("http")}")`) work because the interpolation is passed **directly** to `WithEnvironment`, letting the compiler select Aspire's lazy endpoint-resolving interpolated-string handler.

PyJWT could therefore never fetch signing keys, so no token could ever validate. **Latent** because sign-in doesn't depend on the API's JWKS fetch, and before 3.1 no sync request reached the API to exercise it.

**Resolution:** the API is a host executable (uvicorn) and reaches `identity-proxy` on its fixed host port, so build the URL directly: `$"http://localhost:{zitadelPort}/oauth/v2/keys"`.

### 3.3 Zitadel JWT access tokens carry no `email` claim
**Symptom:** JWKS fixed, `iss` verified matching — and `/sync/*` still 401'd.

**Diagnosis:** this is where link-by-link reasoning had to stop. Every *component* checked out (JWKS reachable and serving keys, `iss` matching, tokens confirmed to be JWTs via `accessTokenType: OIDC_TOKEN_TYPE_JWT`), yet the composition failed. So a real token was minted headlessly — driving the full auth-code + PKCE flow via Zitadel's Session API with the `login-client` PAT (the `IAM_LOGIN_CLIENT` role; the admin PAT is *not* permitted to finalize auth requests) — and decoded:

```
header: {'alg': 'RS256', 'kid': '...', 'typ': 'JWT'}
iss   : https://<cs>-8080.app.github.dev     ✓ matches OIDC_ISSUER
sub   : 381146794005889028                    ✓
email : None                                  ✗ API requires this
all claim keys: ['aud','client_id','exp','iat','iss','jti','nbf','sub']
```

`get_current_user` required a string `email` and rejected the token. Zitadel exposes userinfo claims only via the **ID token** or the **userinfo endpoint** — never in a JWT access token, and there is no app setting to change that (`idTokenUserinfoAssertion` affects the ID token only). Requesting `scope: 'openid profile email'` does not change the access token.

**Resolution:** new [`auth/userinfo.py`](../../../src/backend/clothesline_api/clothesline_api/auth/userinfo.py) resolves `email` from `OIDC_USERINFO_URL` using the caller's own access token. `get_current_user` calls it **only on a user's first authenticated request** — once the local `User` mirror exists, `sub` alone identifies them (`get_user_by_sub`), so the hot sync path makes no extra network call per request. If userinfo can't supply an email the request 401s rather than inventing a user.

### 3.4 `X-Forwarded-Proto` was passed through, not forced
**Symptom:** the new userinfo call returned `{"error":"access_denied","error_description":"access token invalid"}`.

**Diagnosis:** Zitadel derives **both** the issuer it stamps on tokens **and** the instance it resolves per request from `X-Forwarded-Proto` — even with `ZITADEL_EXTERNALSECURE=true`. The Caddyfile passed the header through from the caller (`header_up X-Forwarded-Proto {http.request.header.X-Forwarded-Proto}`). Browser traffic arrives via GitHub's TLS-terminating edge, which sets it to `https`; server-side callers inside the codespace (the API hitting `http://localhost:8080/oidc/v1/userinfo`) send nothing. Zitadel then resolved an `http` instance and rejected a token minted for the `https` issuer. Confirmed by fetching discovery both ways against the same endpoint:

```console
$ curl -s localhost:8080/.well-known/openid-configuration | jq -r .issuer
http://<cs>-8080.app.github.dev
$ curl -s localhost:8080/.well-known/openid-configuration -H 'X-Forwarded-Proto: https' | jq -r .issuer
https://<cs>-8080.app.github.dev
```

This also disproved an earlier hypothesis: fetching discovery through the *real* GitHub edge returned the `https` issuer, so the browser path was never broken — only internal callers were. Worth noting, because "fix" the wrong way (changing `OIDC_ISSUER` to `http`) would have broken the browser.

**Resolution:** the Caddyfile forces `header_up X-Forwarded-Proto {$ZITADEL_FORWARDED_PROTO}`, set from `apphost.cs` to `https` under Codespaces and `http` locally — matching `ExternalSecure`. Browser and server-side callers now agree.

---

## 4. Diagnostic method — what actually worked

Recorded deliberately, because the first two attempts at this were confidently wrong.

- **Reproducing at the network layer beat reading code.** `curl` against the forwarded URL produced the Private-port redirect in one command; no amount of reading `replication.ts` would have shown it.
- **Dumping the *running process's* environment** (`/proc/<pid>/environ`) exposed the `EndpointReference` type-name bug instantly. The source line looked correct and matched neighbouring working lines.
- **Verifying every link individually is not verifying the chain.** JWKS reachable ✓, `iss` matching ✓, token is a JWT ✓ — and the composition still 401'd, because of a claim nobody had inspected. **Minting a real token and decoding it** was the step that ended the guessing. Any future auth change should be validated this way, not by inspection.
- **Testing a hypothesis before acting on it.** The `http` issuer observed on `localhost` looked like the root cause; fetching discovery through the real GitHub edge showed the browser already got `https`, redirecting the fix from "change `OIDC_ISSUER`" (wrong, would break sign-in) to "force the header" (right).
- The headless token flow lives in this session's scratch work; its shape is: create human user → `GET /oauth/v2/authorize` → `POST /v2/sessions` (login-client PAT, password check) → `POST /v2/oidc/auth_requests/{id}` → `POST /oauth/v2/token`. Reusable for any future backend-auth verification.

---

## 5. Incidental fix — the backend test suite was already broken

Discovered while trying to validate: `pytest` at `HEAD` gave **18 failed, 1 passed, 16 errors**, before any change in this session (verified by stashing). Two independent causes, both from `pytest-asyncio` 1.x resolving newer than when the suite was written:

1. Tests are bare `async def` with no `@pytest.mark.asyncio`, and `asyncio_mode` was unset — under the default **strict** mode they all error with *"async def functions are not natively supported"*.
2. `migrated_engine` is session-scoped and its asyncpg pool binds to whichever event loop first touches it; pytest-asyncio's default per-function loop left every subsequent test holding connections owned by a dead loop.

**Resolution** (`clothesline_tests/pyproject.toml`): `asyncio_mode = "auto"`, plus `asyncio_default_fixture_loop_scope`/`asyncio_default_test_loop_scope = "session"`. Suite now runs: **30 passed**.

---

## 6. Verification

All against the live stack, through the **same-origin Vite proxy** — i.e. the exact path the browser takes — using a real Zitadel access token:

```
GET  /sync/loads              -> 200 {"documents":[],"checkpoint":{...}}
POST /sync/loads              -> 200 []            (no conflicts = accepted)
GET  /sync/loads  (pull back) -> [('claude-verify-load','draft')], checkpoint advanced
GET  /auth/me                 -> {"email":"synctest@example.com"}   (resolved via userinfo)
GET  /sync/loads  (no token)  -> 401               (real API 401, not a tunnel redirect)
```

All five replicated collections return 200 — `loads`, `load_item_categories`, `load_items`, `photos`, `photo_links`. This matters specifically because `useSyncStatus`'s `hasError` is **sticky**: any *one* of the five failing would latch the badge permanently.

Test suites: **backend 30/30**, **frontend 29/29**. `ruff check` clean.

---

## 7. Carried-forward risks for later milestones

- **Photo → Azure Blob (Azurite) upload will hit §3.1 again.** It's the next cross-origin browser call, and Azurite's port will be Private just like the API's was. There's no photo-upload UI yet (M6), so it's deferred — but expect it, and prefer proxying over making the port Public.
- **Postgres has no data volume.** Every `aspire run` re-initialises Zitadel: machine-key PATs and the OIDC `client_id` are regenerated and any existing browser session goes stale. Sign in again after a restart rather than assuming a regression. (Adding a data volume would fix this and is worth considering.)
- **The PWA service worker caches the app shell.** After changing `VITE_API_BASE_URL` (or any bundled env), a plain reload can serve the stale bundle and look like the fix didn't work. Hard-reload or let `registerType: 'autoUpdate'` cycle.
- **The API mirrors `email` only at first sight of a `sub`.** Since Zitadel access tokens never carry `email`, `upsert_user`'s email-refresh path is now effectively dead: a user changing their email in Zitadel won't see the local mirror update. Acceptable for a single-user MVP; revisit if `email` is ever used for more than display.
- **`GetEndpoint(...)` interpolated into a plain string `var` is a landmine** (§3.2) — it silently yields the type name, not the URL, with no compiler warning. Anywhere a resolved endpoint URL is needed as a *value*, pass the interpolation directly to `WithEnvironment`/`WithArgs`, or use a fixed host+port. Never an intermediate `string` variable.
- **`server.proxy` is dev-server-only.** `vite build` ignores it, so the production image still needs a real `VITE_API_BASE_URL` from the deploy pipeline. A local `npm run build` now yields same-origin paths — only relevant if the prod bundle is served without the API reverse-proxied under the same origin (an existing ACA-routing concern, §5.6, not introduced here).
- **Bugs 3.2–3.4 were never Codespaces-specific.** They would have failed the same way on ACA. Plain local (non-Codespaces) `aspire run` still hasn't been smoke-tested end-to-end — the `ZITADEL_FORWARDED_PROTO=http` branch in particular is asserted by construction, not exercised.
