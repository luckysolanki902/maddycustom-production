import { defineConfig } from '@playwright/test';

const DEFAULT_PORT = Number(process.env.PLAYWRIGHT_APP_PORT || process.env.PORT || 3000);
const DEFAULT_BASE_URL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${DEFAULT_PORT}`;

export default defineConfig({
  testDir: './tests',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: DEFAULT_BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'api',
    },
  ],
});
