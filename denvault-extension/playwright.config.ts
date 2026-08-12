import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for density mode testing.
 *
 * Run with: pnpm test:e2e
 *
 * Note: For extension testing, we use the dev server
 * and navigate to the extension popup/sidepanel URLs.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    /* Base URL for the Vite dev server */
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      /**
       * Loads the real built extension from dist/, so the service worker,
       * the content-script bridge and the packaged popup are exercised for
       * real. Every other project runs against the dev server with a
       * mocked chrome.*, which cannot see any of that.
       *
       * Needs a build: use `pnpm test:e2e:extension`.
       */
      name: 'extension',
      testMatch: /e2e[\\/]extension[\\/].*\.spec\.ts/,
    },
    {
      name: 'chromium',
      testIgnore: /e2e[\\/]extension[\\/].*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 400, height: 600 }, // Popup size
      },
    },
    {
      name: 'chromium-sidepanel',
      testIgnore: /e2e[\\/]extension[\\/].*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 400, height: 800 }, // Sidepanel size
      },
    },
  ],

  /* Run local dev server before starting tests */
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
