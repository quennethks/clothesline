/**
 * Where the app's deploy-varying settings come from.
 *
 * Vite substitutes `import.meta.env.VITE_*` into the bundle at build time, so
 * anything read that way is frozen when the image is built. That's fine for the
 * API's address (known before the build, and passed in as a build arg), but
 * impossible for the OIDC client_id: Zitadel only generates it once it has been
 * deployed and bootstrapped, long after the bundle exists.
 *
 * So the identity values are fetched from the API's `GET /config` at boot, and
 * the API's own address is seeded from the build-time value — which /config may
 * then correct, if the API has moved since the bundle was built.
 *
 * Resolution order, lowest precedence first:
 *   1. build-time defaults (import.meta.env)
 *   2. the last config we successfully fetched, from localStorage
 *   3. a fresh fetch of /config
 *
 * Step 2 is what makes a cold OFFLINE start work: an installed PWA must open
 * with no network (spec §6.4), and it can't sign in — or even name its issuer —
 * without these. A first-ever launch while offline is the one case we can't
 * serve, and it's also the one case where the user has never been online to
 * authenticate anyway.
 */

export type RuntimeConfig = {
  apiBaseUrl: string
  oidcIssuer: string
  oidcClientId: string
}

const STORAGE_KEY = 'clothesline.runtimeConfig'

const buildTimeDefaults: RuntimeConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  oidcIssuer: import.meta.env.VITE_OIDC_ISSUER ?? '',
  oidcClientId: import.meta.env.VITE_OIDC_CLIENT_ID ?? '',
}

let current: RuntimeConfig = { ...buildTimeDefaults, ...readCached() }

function readCached(): Partial<RuntimeConfig> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Partial<RuntimeConfig>) : {}
  } catch {
    return {}
  }
}

/** The resolved config. Read this at call time — it changes once /config lands. */
export function getConfig(): RuntimeConfig {
  return current
}

export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  try {
    const response = await fetch(`${current.apiBaseUrl}/config`, { cache: 'no-store' })
    if (!response.ok) return current

    const body = await response.json()
    current = {
      // An empty api_base_url means "no correction" — keep the baked-in value,
      // which under `aspire run` is '' anyway (same-origin via the Vite proxy).
      apiBaseUrl: body.api_base_url || current.apiBaseUrl,
      oidcIssuer: body.oidc_issuer || current.oidcIssuer,
      oidcClientId: body.oidc_client_id || current.oidcClientId,
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
    } catch {
      // Private mode / quota — we still have the config for this session.
    }
  } catch {
    // Offline or the API is down. Whatever we already resolved (build-time
    // defaults, possibly overlaid with the cached copy) stands — the app must
    // still open, which is the whole point of being offline-first.
  }

  return current
}
