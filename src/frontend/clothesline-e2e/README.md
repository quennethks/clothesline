# clothesline-e2e

Playwright end-to-end tests (spec §10.3). They drive the **running Aspire
graph** — real web app, real API, real Postgres, real Azurite, real Zitadel core
+ Login V2 — and stub nothing. Sign-in is a genuine OIDC redirect; photo bytes
make a genuine round trip to Blob Storage over a SAS URL.

## Running them

```bash
# 1. bring the graph up (from the repo root)
cd aspire/Clothesline.AppHost && aspire run

# 2. in another terminal
cd src/frontend/clothesline-e2e && npm test
```

Chromium is installed by the dev container's `post-create.sh` into
`/opt/pw-browsers` (`PLAYWRIGHT_BROWSERS_PATH`) — don't run `playwright install`
by hand.

**In a Codespace,** run the graph with the Codespaces env vars unset:

```bash
env -u CODESPACES -u CODESPACE_NAME -u GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN aspire run
```

Otherwise the AppHost builds every browser-facing URL (the OIDC issuer, the Blob
endpoint) as a forwarded `*.app.github.dev` subdomain, which is what a browser on
*your laptop* needs — but Playwright's browser runs *inside* the container, where
those URLs bounce off GitHub's edge and sign-in fails on the discovery fetch. CI
isn't a Codespace, so it needs none of this.

## What's covered

| Spec | File |
|---|---|
| create → itemize → send → receive (match / mismatch / skip), duplicate, delete | `counter-flow.spec.ts` |
| offline create+itemize+send+receive → reconnect → **one** load server-side | `offline.spec.ts` |
| bundle + category photos, auto-count, gallery, offline capture → upload on reconnect | `photos.spec.ts` |
| desktop layout: centred load screens, card grid, side-by-side Sent/Received | `responsive.spec.ts` |
| the PRD's <60s itemize target | `itemize-speed.spec.ts` |

`mobile-chromium` (Pixel 7) is the default project; `desktop-chromium` runs only
`responsive.spec.ts`, since those assertions are only meaningful at a desktop
viewport.
