import { expect, test } from '@playwright/test';
import { seedLanScenario } from './helpers/seed';
import { loginAs } from './helpers/auth';

test('mobile tournament tabs expose overflow sections', async ({ page }) => {
  const { tournamentId } = await seedLanScenario();
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto(`/tournaments/${tournamentId}`);
  await page.getByTestId('tournament-mobile-tab-teams').click();
  await expect(page.getByRole('heading', { name: 'Teams', exact: true })).toBeVisible();

  await page.getByTestId('tournament-mobile-tab-more').click();
  await expect(page.getByTestId('tournament-mobile-more-sheet')).toBeVisible();
  await page.getByTestId('tournament-mobile-tab-overflow-matches').click();
  await expect(page.getByTestId('public-match-board')).toBeVisible();
});

test('player surface nav reaches profile', async ({ page }) => {
  await loginAs(page, 'leo');
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole('link', { name: 'Profile' }).click();
  await expect(page).toHaveURL(/\/profile$/);
});

test('mobile drawer nav works on small screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAs(page, 'leo');
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/dashboard$/);

  // The desktop nav is hidden below md; the hamburger drawer carries navigation + sign-out.
  await page.getByTestId('mobile-nav-toggle').click();
  const panel = page.getByTestId('mobile-nav-panel');
  await expect(panel).toBeVisible();
  await panel.getByRole('link', { name: 'Tournaments' }).click();
  await expect(page).toHaveURL(/\/tournaments$/);
});

test('global command palette opens and executes navigation', async ({ page }) => {
  await loginAs(page, 'leo');
  await page.goto('/dashboard');
  await page.keyboard.press('Control+k');
  await expect(page.getByTestId('command-palette')).toBeVisible();

  // A plain player is never offered the staff boards — middleware would just bounce them.
  await page.getByTestId('command-palette-input').fill('marshal board');
  await expect(page.getByTestId('command-palette-item-go-marshal')).toHaveCount(0);
  await expect(page.getByText('No matching command.')).toBeVisible();

  await page.getByTestId('command-palette-input').fill('tournaments');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/tournaments$/);
});

test('command palette offers the marshal board to staff', async ({ page }) => {
  await loginAs(page, 'marcus');
  await page.goto('/dashboard');
  await page.keyboard.press('Control+k');
  await expect(page.getByTestId('command-palette')).toBeVisible();

  await page.getByTestId('command-palette-input').fill('marshal board');
  await page.getByTestId('command-palette-item-go-marshal').click();
  await expect(page).toHaveURL(/\/marshal\/dashboard$/);
});

test('missing tournament routes render explicit not-found states', async ({ page }) => {
  await page.goto('/tournaments/does-not-exist');
  await expect(page.getByText('Tournament Not Found')).toBeVisible();
});

test('desktop header nav reaches primary targets', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await loginAs(page, 'leo');
  await page.goto('/tournaments');

  await page.getByRole('link', { name: 'My desk' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole('link', { name: 'Tournaments' }).click();
  await expect(page).toHaveURL(/\/tournaments$/);
});

test('tab state survives back-forward and deep-link reload', async ({ page }) => {
  const { tournamentId } = await seedLanScenario();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/tournaments/${tournamentId}?tab=matches`);
  await expect(page.getByTestId('public-match-board')).toBeVisible();

  await page.getByTestId('tournament-mobile-tab-teams').click();
  await expect(page).toHaveURL(new RegExp(`/tournaments/${tournamentId}\\?tab=teams`));
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/tournaments/${tournamentId}\\?tab=matches`));
  await page.reload();
  await expect(page.getByTestId('public-match-board')).toBeVisible();
});

test('unauthorized protected route keeps callback destination', async ({ page }) => {
  const { tournamentId } = await seedLanScenario();
  await page.goto(`/admin/tournaments/${tournamentId}`);
  await expect(page).toHaveURL(new RegExp(`/login\\?callbackUrl=%2Fadmin%2Ftournaments%2F${tournamentId}`));
});
