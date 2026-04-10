import { expect, test } from '@playwright/test';
import { seedLanScenario } from './helpers/seed';

async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login?callbackUrl=/admin');
  await page.getByTestId('admin-password').fill('test-admin');
  await page.getByTestId('admin-login-submit').click();
  await expect(page).toHaveURL(/\/admin$/);
}

test('mobile tournament tabs expose overflow sections', async ({ page }) => {
  const { tournamentId } = await seedLanScenario();
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto(`/tournaments/${tournamentId}`);
  await page.getByTestId('tournament-mobile-tab-teams').click();
  await expect(page.getByText('Verified participants currently enrolled in the tournament.')).toBeVisible();

  await page.getByTestId('tournament-mobile-tab-more').click();
  await expect(page.getByTestId('tournament-mobile-more-sheet')).toBeVisible();
  await page.getByTestId('tournament-mobile-tab-overflow-matches').click();
  await expect(page.getByText(/Round\s+1/i)).toBeVisible();
});

test('mobile workspace nav keeps profile reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard');
  await page.getByTestId('mock-persona-leo').click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByTestId('workspace-mobile-nav-profile').click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByText(/Player profile/i)).toBeVisible();
});

test('global command palette opens and executes navigation', async ({ page }) => {
  await page.goto('/dashboard');
  await page.keyboard.press('Control+k');
  await expect(page.getByTestId('command-palette')).toBeVisible();

  await page.getByTestId('command-palette-input').fill('marshal board');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fmarshal%2Fdashboard/);
});

test('missing tournament routes render explicit not-found states', async ({ page }) => {
  await page.goto('/tournaments/does-not-exist');
  await expect(page.getByText('Tournament Not Found')).toBeVisible();
});

test('desktop header nav reaches primary targets', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/tournaments');

  await page.getByRole('link', { name: 'Dashboard' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole('link', { name: 'Tournaments' }).click();
  await expect(page).toHaveURL(/\/tournaments$/);
});

test('tab state survives back-forward and deep-link reload', async ({ page }) => {
  const { tournamentId } = await seedLanScenario();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/tournaments/${tournamentId}?tab=matches`);
  await expect(page.getByText(/Round\s+1/i)).toBeVisible();

  await page.getByTestId('tournament-mobile-tab-teams').click();
  await expect(page).toHaveURL(new RegExp(`/tournaments/${tournamentId}\\?tab=teams`));
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/tournaments/${tournamentId}\\?tab=matches`));
  await page.reload();
  await expect(page.getByText(/Round\s+1/i)).toBeVisible();
});

test('unauthorized protected route keeps callback destination', async ({ page }) => {
  const { tournamentId } = await seedLanScenario();
  await page.goto(`/admin/tournaments/${tournamentId}`);
  await expect(page).toHaveURL(new RegExp(`/login\\?callbackUrl=%2Fadmin%2Ftournaments%2F${tournamentId}`));
});
