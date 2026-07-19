# Post-Fix Report — Zitadel admin console unusable on the deployed environment

> **Companion to:** [`technical-implementation-spec.md`](../technical-implementation-spec.md) §5.6(a), §5.6(b) · [`2026-07-05-codespaces-oidc-signin.md`](./2026-07-05-codespaces-oidc-signin.md) (introduced `identity-proxy`, whose Host rewriting is half of this bug)
> **Milestone:** M5 (Zitadel auth) — deploy follow-up, not a new milestone
> **Document date:** 17 July 2026
> **Status:** Fixed in code and deployed; confirmed live on the identity domain, including two follow-on incidents this rollout surfaced (§7).
> **Purpose:** Record why the admin console was unreachable *in effect* though never blocked, the two independent root causes, and why the fix lives in the proxy rather than in configuration.

---

## 1. Summary

The Zitadel admin console at `https://<identity-domain>/ui/console` loaded its HTML but could not perform a single action. The reported symptom was "I can't access the Zitadel admin console", and the natural first assumption — that `identity-proxy` was blocking or failing to route `/ui/console` — was **wrong**. `/ui/console` returned `200` throughout; the Caddyfile has no denylist and its second `handle` is a catch-all that already routed the console to Zitadel core.

The console is a SPA that bootstraps from a single file, `/ui/console/assets/environment.json`, whose `api` field is the base URL it uses for **every** subsequent management API call. On the deployed environment that file read:

```json
{"api":"http://zitadel.internal.bluewave-1cb694bd.southeastasia.azurecontainerapps.io",
 "issuer":"https://identity.clothesline-dev.surbandev.network",
 "clientid":"381474223673118957"}
```

That `api` value is unusable from a browser twice over: the hostname is an **ACA-internal FQDN** (resolvable only inside the Container Apps environment), and the scheme is **`http`** on an `https` page (mixed content). So the shell loaded and every call from it failed — indistinguishable, from the outside, from being denied access.

Two independent root causes, both required to produce it, and both fixed here.

---

## 2. Root cause 1 — `--tlsMode disabled` silently killed `ExternalSecure` (the `http` half)

`apphost.cs` passed Zitadel `--tlsMode disabled` while *also* setting `ZITADEL_EXTERNALSECURE=true`. These contradict, and the flag wins — silently. From Zitadel's [`cmd/tls/tls.go`](https://github.com/zitadel/zitadel/blob/v4.15.3/cmd/tls/tls.go):

```go
case "disabled":
    tlsEnabled = false
    externalSecure = false
...
viper.Set("tls.enabled", tlsEnabled)
viper.Set("externalSecure", externalSecure)
```

`viper.Set` has the highest precedence in viper — above env vars — so `ZITADEL_EXTERNALSECURE=true` was **dead config** in every environment, reading as authoritative while doing nothing. The flag's own help text says so outright: *"this flag will overwrite `externalSecure` and `tls.enabled` in configs files"*.

The correct mode when TLS is terminated by a component in front is `external` (`tls.enabled=false`, `externalSecure=true`) — which is exactly what **spec §5.6(b) already prescribed**: *"Zitadel runs in external-TLS mode: `ExternalSecure=true`, `TLS_ENABLED=false`"*. The spec was right; the code did not implement it.

**Why this hid for so long:** the OIDC issuer is built on a *different* code path (`oidcServer.IssuerFromRequest` → `DomainContext`), which honours `identity-proxy`'s `X-Forwarded-Proto: https` and therefore produced a correct `https://` issuer regardless. Sign-in worked. Only the console, which reads `externalSecure` directly, exposed the setting's true value.

**Beyond the console:** `externalSecure=false` also means Zitadel does not mark session cookies `Secure` on a live HTTPS IdP. That is a real security defect in its own right, independent of this bug, and is fixed by the same change.

---

## 3. Root cause 2 — the console's `api` is built from the raw `Host` header (the internal-FQDN half)

From [`internal/api/ui/console/console.go:125`](https://github.com/zitadel/zitadel/blob/v4.15.3/internal/api/ui/console/console.go#L125):

```go
url := http_util.BuildOrigin(r.Host, externalSecure)
```

and `BuildOrigin` is literally `fmt.Sprintf("%s://%s", schema, host)`.

So the console's `api` is `{scheme}://{Host header}` **and nothing else**. It ignores `x-zitadel-forward-host` (`ZITADEL_HTTP1HOSTHEADER`), `X-Forwarded-Host`, and the entire `DomainContext` that every other route resolves the instance from — i.e. precisely the mechanisms `apphost.cs` and the Caddyfile rely on to tell Zitadel its public identity in Azure.

This collides head-on with an ACA constraint that `identity-proxy` cannot escape:

- **The console needs** Zitadel core to see `Host: <identity-domain>`.
- **ACA needs** Caddy to send `Host: zitadel.internal.<env>` — ACA's ingress routes strictly by Host and `404`s anything else. (Confirmed empirically: a request to a container app's FQDN carrying a foreign `Host` returns `404`.) This bind is already documented in `apphost.cs` and was the reason `ZITADEL_HTTP1HOSTHEADER` exists at all.

The two are irreconcilable for as long as an ACA ingress hop sits between the proxy and Zitadel core. There is no configuration escape: console's `Config` struct exposes only `ShortCache`, `LongCache`, `InstanceManagementURL` and `PostHog` — **no override for `api`** — and upstream `main` still carries the identical line, so this is not fixed by upgrading Zitadel.

Locally and in Codespaces the bug cannot occur, because the upstream host and the browser-facing host are the same value there. It is a deploy-only defect, which is why the e2e suite never caught it.

---

## 4. Resolution

### 4.1 `apphost.cs` — mode flag, and deleting the dead env var

`--tlsMode` is now `external` wherever the browser arrives over HTTPS, and `ZITADEL_EXTERNALSECURE` is **removed** rather than corrected — leaving it would restore exactly the misleading contradiction that caused this:

```csharp
"--tlsMode", (isPublish || isCodespaces) ? "external" : "disabled",
```

This also fixes Codespaces, where `externalSecure` was likewise silently `false` behind an HTTPS edge.

**Invariant this establishes,** which §4.2 depends on: `--tlsMode` and `identity-proxy`'s `ZITADEL_FORWARDED_PROTO` are keyed off the *same* condition, so `externalSecure` ⇔ `ZITADEL_FORWARDED_PROTO == "https"` in all three environments.

### 4.2 `identity-proxy` — correct the origin on the way out

Since Zitadel cannot be told the right answer and the `Host` header cannot be changed, the response is corrected as it leaves the proxy. `ops/identity-proxy/Dockerfile` now rebuilds Caddy with the [`replace-response`](https://github.com/caddyserver/replace-response) plugin (pinned to a commit — it has no tagged releases), and the Caddyfile gains a route scoped to the single affected file:

```
handle /ui/console/assets/environment.json {
	replace "{$ZITADEL_FORWARDED_PROTO}://{$ZITADEL_UPSTREAM_HOST}" "{$ZITADEL_FORWARDED_PROTO}://{$ZITADEL_HOST_HEADER}"
	reverse_proxy {$ZITADEL_UPSTREAM} {
		import zitadel_core_headers
		header_up Accept-Encoding identity
	}
}
```

Four properties worth recording:

- **No new configuration.** Both sides of the replacement are existing env vars. `ZITADEL_UPSTREAM_HOST` *is* what Caddy puts in `Host`, which *is* Zitadel's `r.Host`; `ZITADEL_HOST_HEADER` is the browser-facing origin. Nothing new to wire, no new parameter, no new secret.
- **A no-op by construction locally.** In run mode those two vars hold the same value, so search and replace are identical strings. The rule costs nothing in dev and needed no `isPublish` fork.
- **`clientid` stays dynamic.** Zitadel's own response passes through; only the origin substring changes. A statically-served `environment.json` would have had to hardcode the instance's `ManagementConsoleClientID`, which is minted at first boot and would break on a fresh identity database.
- **`header_up Accept-Encoding identity` is mandatory, not decorative.** The plugin cannot rewrite a compressed body and fails *silently* if it meets one.

The shared `header_up` block for Zitadel core was extracted into a `(zitadel_core_headers)` snippet so the two routes cannot drift — those headers encode hard-won knowledge from [`2026-07-05-codespaces-oidc-signin.md`](./2026-07-05-codespaces-oidc-signin.md).

### 4.3 Options rejected

- **Merge Caddy into Zitadel core's container app as a sidecar** (removing the ACA hop, so Caddy could set `Host` freely). Architecturally the "correct" fix, and rejected on evidence: Aspire has no sidecar concept (`PublishAsAzureContainerApp` is strictly one resource → one container), the image would only get built if the resource kept a deployment target — leaving a vestigial container app whose sole purpose is to make an image exist — `aspire run` could not express it, so dev/prod parity (the very thing §5.6a's decision bought) would be lost. Decisively: it would force login-v2's **gRPC back through Caddy**, which `apphost.cs` already documents as broken and routes around. It trades a working sign-in path for a working console.
- **Serve `environment.json` statically from Caddy.** Needs the console's `clientid` as a deploy parameter (see above), and duplicates a response contract that upstream can extend at will.
- **Binding the identity domain to the internal `zitadel` app.** A custom domain is unique per ACA environment, and `identity-proxy` already holds it.

---

## 5. Verification

Reproduced the deployed configuration locally against a stub upstream mimicking `BuildOrigin(r.Host, externalSecure)`, since the bug cannot be reproduced by `aspire run` itself (§3):

| Case | Result |
|---|---|
| Azure-like (upstream host ≠ browser host) | `api` rewritten to `https://identity.clothesline-dev.surbandev.network`; `issuer` and `clientid` untouched |
| Browser sends `Accept-Encoding: gzip` | Still rewritten — confirms the compression trap is handled |
| Local-like (upstream host = browser host) | Unchanged `http://localhost:8080` — no-op confirmed |
| Any other path | Passes through unrewritten, `Host` still forced to the upstream |

**On the live environment after deploy:**

1. `curl -s https://<identity-domain>/ui/console/assets/environment.json` → `api` is the identity origin over `https`, and `clientid` is still the live numeric id (proves the response is Zitadel's, not a static stand-in).
2. `curl -s https://<identity-domain>/.well-known/openid-configuration` → issuer unchanged (no regression from the `tlsMode` change).
3. Playwright e2e against the deployed environment → sign-in still works.
4. Load `/ui/console` in a browser: no mixed-content or failed API calls in devtools. The stray internal host still present in the CSP `connect-src`/`img-src` is now inert, since the console is served from the identity origin and CSP already allows `'self'`.
5. Confirm a session cookie now carries `Secure` (§2).

**Rollout is order-independent** — no orchestration needed. If `zitadel` lands first the console gets `https://<internal>` (still broken, no worse); if `identity-proxy` lands first its search string doesn't match the old `http://<internal>` (still broken, no worse). It converges only when both are live. No data migration, no downtime, and the identity domain does not move.

---

## 6. Spec impact

**None — deliberately.** Spec §5.6(b) already prescribed external-TLS mode with `ExternalSecure=true`; the code simply did not implement it. Per CLAUDE.md's *"supersede reversed decisions, not everything"*, a decision was not reversed here, so **no supersession banner is warranted**. §5.6(a)'s `identity-proxy` decision likewise stands unchanged — this fix strengthens it.

---

## 7. Deploy incident — two more things this rollout broke, both now fixed

Deploying §4 surfaced two further issues, neither present in the code as reviewed — both are now fixed and documented as `ops/DEPLOY.md`'s Known-issue 0f and 0g respectively. Recorded here because both were direct or incidental consequences of *this* change landing, not independent bugs found separately.

**0f — the OIDC bootstrap job started 401ing.** It calls Zitadel directly (bypassing `identity-proxy`, same as Login V2 — see Known issue 0b2) and, unlike a browser or the proxy, never sent `X-Forwarded-Proto`. Zitadel treats that as `http`; once §4.1 made `externalSecure=true`, the mismatch made every Management API call — including the admin PAT itself — fail with `401`. Fixed by having `bootstrap_oidc_app.py` send the header explicitly, forced by `apphost.cs` to the same condition as everywhere else this scheme is decided.

**0g — a stale local Aspire deployment state silently minted a new Zitadel masterkey.** Unrelated to this fix's code, but discovered while chasing 0f: `zitadel-masterkey` is a `persist: true` parameter, meant to be stable across deploys — but its persistence lives in a local file keyed by a hash that turned out to be sensitive to the AppHost's checkout path. Deploying from a second `git worktree` of this repo resolved to a different hash than the checkout that ran the first deploy ever had, found no persisted value, and silently generated a fresh key — which was then pushed to the live `zitadel` container, orphaning every PAT and (very plausibly) every signing key already encrypted under the old one. This is what 0f's `401` was actually rooted in for the *admin PAT specifically*: Zitadel's own logs distinguished it clearly from a scheme mismatch (`CRYPT-OhN2u`/`CRYPT-Eep6o`, "illegal base64 data", not the `AUTH-7fs1e` token-invalid signature 0f produces). Recovered by pulling the original key out of the oldest `~/.aspire/deployments/*/development.json` on record, resetting it on the live container, and correcting the newer (worktree) state file to match so the next deploy doesn't repeat it. See Known issue 0g for the full mechanism and recovery steps — it is not specific to this change and can recur on any future deploy from an unfamiliar checkout.

## 8. Carried-forward notes

- **`replace-response` is pinned to a commit,** not a tag, because the plugin publishes none. Revisit if it ever tags a release.
- **The rule is coupled to Zitadel's internals.** If a future Zitadel changes `BuildOrigin(r.Host, ...)` to honour `DomainContext` (the correct upstream fix, and worth watching for), the search string stops matching and the console breaks again — failing the same way it does today, i.e. visibly on the smoke check in `ops/DEPLOY.md`. Delete the route if that lands.
- **The `--tlsMode`/`ZITADEL_FORWARDED_PROTO` lockstep is load-bearing** (§4.1). Changing one without the other silently breaks the rewrite.
- **`identity-proxy`'s own ACA ingress `transport` is never set** (defaults to `auto`), while `zitadel`'s is pinned to `Http2`. Untouched here as it is not implicated in this bug, but it is the same seam §5.6(b) warns about and the reason gRPC bypasses Caddy today.
