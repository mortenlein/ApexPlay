import path from 'path';
import { defineConfig, devices } from '@playwright/test';

const DATABASE_URL = `file:${path.resolve(process.cwd(), 'prisma', 'e2e.db').replace(/\\/g, '/')}`;
process.env.DATABASE_URL = DATABASE_URL;
process.env.ADMIN_PASSWORD = 'test-admin';
process.env.MOCK_AUTH_MODE = 'true';
process.env.NEXT_PUBLIC_MOCK_AUTH = 'true';
process.env.NEXT_PUBLIC_STRATEGY_3_MOCK = 'true';
process.env.NEXTAUTH_SECRET = 'test-secret';
process.env.NEXTAUTH_URL = 'http://127.0.0.1:4101';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:4101',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev:e2e',
    url: 'http://127.0.0.1:4101',
    reuseExistingServer: false,
    timeout: 180000,
    env: {
      ...process.env,
      DATABASE_URL,
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
