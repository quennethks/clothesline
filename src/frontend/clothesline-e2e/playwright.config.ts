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
      // The desktop-layout assertions (spec §6.5) are only meaningful at a
      // desktop viewport, so that spec runs here and only here.
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      testMatch: /responsive\.spec\.ts/,
    },
  ],
})
