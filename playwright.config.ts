import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E Configuration — Yahweh HRMS
 *
 * Default base URL: staging (yahwehcare-hrmsapp.vercel.app)
 * Override: BASE_URL env var → e.g. http://localhost:3000 for local dev
 *
 * Run: npx playwright test
 * Run headed: npx playwright test --headed
 * Run single spec: npx playwright test e2e/auth.spec.ts
 * CI: npx playwright test --reporter=github
 */

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,          // auth tests share rate-limiter; keep serial
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,                   // one browser at a time (rate-limit safety)
  timeout: 120_000,             // 2 min — covers loginAs retry waits (up to 65s)
  expect: { timeout: 10_000 },

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ...(process.env.CI ? [['github'] as ['github']] : []),
  ],

  use: {
    baseURL: process.env.BASE_URL ?? 'https://yahwehcare-hrmsapp.vercel.app',
    trace:   'on-first-retry',
    screenshot: 'only-on-failure',
    video:   'off',
  },

  projects: [
    // ── Auth state setup (runs before all spec files) ───────────────
    {
      name: 'setup-hr',
      testMatch: '**/setup/auth.setup.ts',
      use: { ...devices['Desktop Chrome'] },
    },

    // ── Main test suite ─────────────────────────────────────────────
    {
      name: 'e2e',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/hr_officer.json',
      },
      dependencies: ['setup-hr'],
      testIgnore: '**/rbac.spec.ts',
    },

    // ── RBAC suite (no auth dependency — sets up its own sessions) ──
    {
      name: 'rbac',
      testMatch: '**/rbac.spec.ts',
      use: { ...devices['Desktop Chrome'] },
      dependencies: [],
    },
  ],
})
