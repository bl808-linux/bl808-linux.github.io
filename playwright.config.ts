import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  use: { baseURL: 'http://127.0.0.1:4321', ...devices['Desktop Chrome'] },
  webServer: { command: 'npm run preview -- --port 4321 --ignore-lock', url: 'http://127.0.0.1:4321', reuseExistingServer: !process.env.CI },
  reporter: 'list',
});
