# clothesline-web

Offline-first PWA frontend for Clothesline — tracks laundry sent to and received from per-kilo laundry shops.

## Tech stack

- **Vite** + **React** (TypeScript)
- **RxDB** (IndexedDB) — local system of record, syncs to the API when online
- **react-oidc-context** — OIDC authentication against a self-hosted Zitadel instance
- **vite-plugin-pwa** — service worker + installable PWA

## Local development

Run everything (API, Postgres, Zitadel, Azurite, this frontend) together with:

```bash
aspire run
```

from the repo root. The Aspire dashboard shows logs, traces, and metrics for all services.

To run only the frontend dev server in isolation (against an already-running Aspire graph):

```bash
npm run dev
```

## Tests

```bash
# Unit tests (Vitest)
npm run test

# Lint
npm run lint
```

End-to-end tests live in `../clothesline-e2e`. See that package's README for how to run the Playwright suite against a full Aspire graph.
