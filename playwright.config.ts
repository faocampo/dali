import { defineConfig, devices } from '@playwright/test';

const DEV_URL = 'http://127.0.0.1:5494';
const PROD_URL = 'http://127.0.0.1:5493';
const DEV_ONLY = /account-workspace\.spec\.ts/;
const ACCESS_SUITES = /(?:authentication|board-access|board-library|board-sharing|board-actions|board-roles|session-recovery|local-board-import|access-boundaries|accessibility-access)\.spec\.ts/;

export default defineConfig({
  testDir: './tests',
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  reporter: [['list']],
  timeout: 120_000,
  expect: { timeout: 20_000 },
  use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
  projects: [
    { name: 'dev', testMatch: /.*\.spec\.ts/, use: { baseURL: DEV_URL } },
    { name: 'prod', testMatch: /.*\.spec\.ts/, testIgnore: DEV_ONLY, use: { baseURL: PROD_URL } },
    { name: 'prod-firefox', testMatch: /.*\.spec\.ts/, testIgnore: DEV_ONLY, use: { ...devices['Desktop Firefox'], baseURL: PROD_URL } },
    { name: 'prod-webkit', testMatch: /.*\.spec\.ts/, testIgnore: DEV_ONLY, use: { ...devices['Desktop Safari'], baseURL: PROD_URL } },
    { name: 'access', testMatch: ACCESS_SUITES, testIgnore: DEV_ONLY, use: { baseURL: PROD_URL } },
  ],
  webServer: [
    {
      command: 'npm run test:access:server',
      url: 'http://127.0.0.1:5497/api/session',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'npm run dev:ui -- --host 127.0.0.1 --port 5494 --strictPort',
      env: { DALI_API_PROXY_TARGET: 'http://127.0.0.1:5495' },
      url: DEV_URL,
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 5493 --strictPort',
      env: { DALI_API_PROXY_TARGET: 'http://127.0.0.1:5497' },
      url: PROD_URL,
      reuseExistingServer: false,
      timeout: 300_000,
    },
  ],
});
