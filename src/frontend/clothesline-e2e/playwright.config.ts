import { defineConfig, devices } from '@playwright/test'

// The suite drives the *running Aspire graph* (spec §10.3) — real web app, real
// API, real Postgres, real Azurite, and a real Zitadel core + Login V2. It does
// not spin services up itself: `aspire run` owns the topology (see README), so
// these are the fixed ports the AppHost publishes.
export const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:5173'
export const MAILPIT_URL = process.env.E2E_MAILPIT_URL ?? 'http://localhost:8025'

export default defineConfig({
  testDir: './tests',
  // Each spec signs in a fresh user and owns its own loads, but they share one
  // browser + one backing database; serial keeps the offline/online toggling in
  // one spec from surprising another.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Zitadel and the web app are served over the AppHost's dev certs.
    ignoreHTTPSErrors: true,
    permissions: [],
    // A synthetic camera, so getUserMedia resolves headlessly with no hardware.
    // BOTH flags are required on this Chromium build: --use-fake-device alone
    // throws NotSupportedError; only --use-fake-ui activates the fake capture
    // pipeline. --use-fake-ui also auto-accepts the permission (it ignores
    // Playwright's permissions:[]), so permission-based denial can't be
    // expressed — camera.spec.ts's denied case instead stubs getUserMedia to
    // reject, which drives the same useCamera catch → Unavailable path (spec §8).
    // --disable-dev-shm-usage: containers often mount a tiny (64MB) /dev/shm,
    // which Chromium exhausts and the renderer crashes ("page crashed"); this
    // moves its shared memory to /tmp. Harmless on a well-provisioned host.
    launchOptions: {
      args: [
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
        '--disable-dev-shm-usage',
      ],
    },
  },
  projects: [
    {
      // A phone is the primary device — everything but the desktop-layout spec
      // runs here.
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'], isMobile: true, hasTouch: true },
      testIgnore: /responsive\.spec\.ts/,
    },
    {
      // The desktop-layout assertions (spec §6.5) run here and only here — plus
      // camera.spec.ts, because the camera's whole premise is that desktop and
      // mobile behave alike, so it must be exercised on *both* projects. Without
      // widening this, a new spec would silently run on mobile only (spec §8).
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      testMatch: /(responsive|camera)\.spec\.ts/,
    },
  ],
})
