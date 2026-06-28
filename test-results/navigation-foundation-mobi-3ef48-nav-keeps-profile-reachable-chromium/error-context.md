# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: navigation-foundation.spec.ts >> mobile workspace nav keeps profile reachable
- Location: e2e/navigation-foundation.spec.ts:25:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByTestId('workspace-mobile-nav-profile')
    - waiting for" http://127.0.0.1:4101/api/auth/error" navigation to finish...
    - navigated to "http://127.0.0.1:4101/api/auth/error"

```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test';
  2  | import { seedLanScenario } from './helpers/seed';
  3  | 
  4  | async function loginAsAdmin(page: import('@playwright/test').Page) {
  5  |   // "marcus" mock persona's steamid is in ADMIN_STEAMIDS (see playwright.config.ts).
  6  |   await page.goto('/login?callbackUrl=/admin');
  7  |   await page.getByTestId('mock-persona-marcus').click();
  8  |   await expect(page).toHaveURL(/\/admin$/);
  9  | }
  10 | 
  11 | test('mobile tournament tabs expose overflow sections', async ({ page }) => {
  12 |   const { tournamentId } = await seedLanScenario();
  13 |   await page.setViewportSize({ width: 390, height: 844 });
  14 | 
  15 |   await page.goto(`/tournaments/${tournamentId}`);
  16 |   await page.getByTestId('tournament-mobile-tab-teams').click();
  17 |   await expect(page.getByText('Verified participants currently enrolled in the tournament.')).toBeVisible();
  18 | 
  19 |   await page.getByTestId('tournament-mobile-tab-more').click();
  20 |   await expect(page.getByTestId('tournament-mobile-more-sheet')).toBeVisible();
  21 |   await page.getByTestId('tournament-mobile-tab-overflow-matches').click();
  22 |   await expect(page.getByText(/Round\s+1/i)).toBeVisible();
  23 | });
  24 | 
  25 | test('mobile workspace nav keeps profile reachable', async ({ page }) => {
  26 |   await page.setViewportSize({ width: 390, height: 844 });
  27 |   await page.goto('/dashboard');
  28 |   await page.getByTestId('mock-persona-leo').click();
  29 |   await expect(page).toHaveURL(/\/dashboard$/);
  30 | 
> 31 |   await page.getByTestId('workspace-mobile-nav-profile').click();
     |                                                          ^ Error: locator.click: Test timeout of 30000ms exceeded.
  32 |   await expect(page).toHaveURL(/\/profile$/);
  33 |   await expect(page.getByText(/Player profile/i)).toBeVisible();
  34 | });
  35 | 
  36 | test('global command palette opens and executes navigation', async ({ page }) => {
  37 |   await page.goto('/dashboard');
  38 |   await page.keyboard.press('Control+k');
  39 |   await expect(page.getByTestId('command-palette')).toBeVisible();
  40 | 
  41 |   await page.getByTestId('command-palette-input').fill('marshal board');
  42 |   await page.keyboard.press('Enter');
  43 |   await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fmarshal%2Fdashboard/);
  44 | });
  45 | 
  46 | test('missing tournament routes render explicit not-found states', async ({ page }) => {
  47 |   await page.goto('/tournaments/does-not-exist');
  48 |   await expect(page.getByText('Tournament Not Found')).toBeVisible();
  49 | });
  50 | 
  51 | test('desktop header nav reaches primary targets', async ({ page }) => {
  52 |   await page.setViewportSize({ width: 1366, height: 900 });
  53 |   await page.goto('/tournaments');
  54 | 
  55 |   await page.getByRole('link', { name: 'Dashboard' }).click();
  56 |   await expect(page).toHaveURL(/\/dashboard$/);
  57 | 
  58 |   await page.getByRole('link', { name: 'Tournaments' }).click();
  59 |   await expect(page).toHaveURL(/\/tournaments$/);
  60 | });
  61 | 
  62 | test('tab state survives back-forward and deep-link reload', async ({ page }) => {
  63 |   const { tournamentId } = await seedLanScenario();
  64 |   await page.setViewportSize({ width: 390, height: 844 });
  65 |   await page.goto(`/tournaments/${tournamentId}?tab=matches`);
  66 |   await expect(page.getByText(/Round\s+1/i)).toBeVisible();
  67 | 
  68 |   await page.getByTestId('tournament-mobile-tab-teams').click();
  69 |   await expect(page).toHaveURL(new RegExp(`/tournaments/${tournamentId}\\?tab=teams`));
  70 |   await page.goBack();
  71 |   await expect(page).toHaveURL(new RegExp(`/tournaments/${tournamentId}\\?tab=matches`));
  72 |   await page.reload();
  73 |   await expect(page.getByText(/Round\s+1/i)).toBeVisible();
  74 | });
  75 | 
  76 | test('unauthorized protected route keeps callback destination', async ({ page }) => {
  77 |   const { tournamentId } = await seedLanScenario();
  78 |   await page.goto(`/admin/tournaments/${tournamentId}`);
  79 |   await expect(page).toHaveURL(new RegExp(`/login\\?callbackUrl=%2Fadmin%2Ftournaments%2F${tournamentId}`));
  80 | });
  81 | 
```