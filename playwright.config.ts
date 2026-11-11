import { defineConfig, devices } from '@playwright/test';

// Load DEMO_PASSWORD and other values from .env, if it exists (Node 22 has process.loadEnvFile)
try { process.loadEnvFile('.env'); } catch {}

export default defineConfig({
  testDir: './tests',
  retries: 0,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm start',
    url: 'http://localhost:3000/api/health',
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
