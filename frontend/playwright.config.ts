import { defineConfig, devices } from '@playwright/test';

const deployedBaseUrl = process.env.PLAYWRIGHT_BASE_URL?.trim();
const baseURL = deployedBaseUrl || 'http://127.0.0.1:5174';
const shouldManageWebServer = !deployedBaseUrl;

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: {
    timeout: 8_000,
  },
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: shouldManageWebServer ? {
    command: 'npm run dev -- --host 127.0.0.1',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  } : undefined,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
