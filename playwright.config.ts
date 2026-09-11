import { defineConfig, devices } from '@playwright/test';

const DEV_URL = 'http://127.0.0.1:5494';
const PROD_URL = 'http://127.0.0.1:5493';

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
    { name: 'prod', testMatch: /.*\.spec\.ts/, use: { baseURL: PROD_URL } },
    { name: 'prod-firefox', testMatch: /.*\.spec\.ts/, use: { ...devices['Desktop Firefox'], baseURL: PROD_URL } },
    { name: 'prod-webkit', testMatch: /.*\.spec\.ts/, use: { ...devices['Desktop Safari'], baseURL: PROD_URL } },
  ],
  webServer: [
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5494 --strictPort',
      url: DEV_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 5493 --strictPort',
      url: PROD_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
    },
  ],
});
