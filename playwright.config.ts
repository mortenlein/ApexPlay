import path from 'path';
import { defineConfig, devices } from '@playwright/test';

const DATABASE_URL = `file:${path.resolve(process.cwd(), 'prisma', 'e2e.db').replace(/\\/g, '/')}`;
process.env.DATABASE_URL = DATABASE_URL;
// Admin is an identity now: the "marcus" mock persona (steamid below) resolves to admin.
process.env.ADMIN_STEAMIDS = '76561198000000001';
process.env.MOCK_AUTH_MODE = 'true';
process.env.NEXT_PUBLIC_MOCK_AUTH = 'true';
process.env.NEXT_PUBLIC_STRATEGY_3_MOCK = 'true';
process.env.NEXTAUTH_SECRET = 'test-secret';
process.env.NEXTAUTH_URL = 'http://127.0.0.1:4101';
// SteamProvider throws "clientSecret is empty" on construction without this, which 500s
// EVERY /api/auth/* request (providers, session, signin) and breaks all auth in tests.
process.env.STEAM_API_KEY = 'e2e-placeholder';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // Generous timeouts: `next dev` compiles each heavy route on first hit (the manage cockpit
  // and marshal board take ~10-15s), which delays client-nav URL changes and element waits.
  timeout: 90000,
  expect: { timeout: 20000 },
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
