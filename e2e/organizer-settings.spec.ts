import { expect, test, type Page } from '@playwright/test';
import { disposeApiContexts } from './helpers/api';
import { createTournament, readTournament } from './helpers/lan-seed';
import { loginAs } from './helpers/auth';

/**
 * The settings tab of the manage workspace. Every control here writes straight through to
 * `PATCH /api/tournaments/[id]` with the row's `updatedAt` as a concurrency token, which is why
 * the rename is committed on blur/Enter rather than per keystroke — a request per keystroke would
 * make every keystroke after the first conflict. That contract is what these tests hold onto:
 * one commit is one PATCH, Escape is not a commit at all, and each toggle/select is readable back
 * from the database in the shape the API stores (0 for a BO stage means "off", stored as null).
 */
test.describe.configure({ mode: 'serial' });
test.afterEach(disposeApiContexts);

const uniqueName = (prefix: string) => `${prefix} ${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`;

/** A CS2 5v5 tournament with nothing else in it, opened on the settings tab as the organizer. */
async function openSettings(page: Page, tournamentId: string) {
  await page.goto(`/admin/tournaments/${tournamentId}?tab=settings`);
  await expect(page.getByRole('heading', { name: 'Tournament Settings' })).toBeVisible();
}

async function settingsFixture(page: Page) {
  const tournament = await createTournament({ name: uniqueName('Settings Cup'), teamSize: 5 });
  await loginAs(page, 'marcus');
  await openSettings(page, tournament.id);
  return tournament;
}

/** Every PATCH the page sends to this tournament, so a test can count them. */
function recordTournamentPatches(page: Page, tournamentId: string) {
  const patches: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'PATCH' && request.url().endsWith(`/api/tournaments/${tournamentId}`)) {
      patches.push(request.url());
    }
  });
  return patches;
}

test('a rename commits on blur with exactly one PATCH', async ({ page }) => {
  const tournament = await settingsFixture(page);
  const patches = recordTournamentPatches(page, tournament.id);
  const renamed = uniqueName('Renamed Cup');

  const nameInput = page.locator('#tournament-name');
  await expect(nameInput).toHaveValue(tournament.name);
  await nameInput.fill(renamed);
  await expect(page.getByText('Unsaved change - press Enter or save.')).toBeVisible();

  await nameInput.blur();

  await expect(page.getByText('Settings updated')).toBeVisible();
  await expect.poll(async () => (await readTournament(tournament.id)).name).toBe(renamed);
  // The workspace header renames itself off the same refreshed row.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(renamed.toUpperCase(), { ignoreCase: true });
  expect(patches).toHaveLength(1);
});

test('Escape abandons a rename without a request', async ({ page }) => {
  const tournament = await settingsFixture(page);
  const patches = recordTournamentPatches(page, tournament.id);

  const nameInput = page.locator('#tournament-name');
  await nameInput.fill('Typed And Regretted');
  await nameInput.press('Escape');

  await expect(nameInput).toHaveValue(tournament.name);
  await expect(page.getByText('Saved.')).toBeVisible();
  // Blurring the reverted field is not a commit either.
  await nameInput.blur();
  await expect(page.getByText('Settings updated')).toHaveCount(0);
  expect(patches).toHaveLength(0);
  expect((await readTournament(tournament.id)).name).toBe(tournament.name);
});

test('switching the bracket style persists and keeps `type` in step', async ({ page }) => {
  const tournament = await settingsFixture(page);
  expect(tournament.format).toBe('SINGLE_ELIMINATION');

  const doubleElim = page.getByRole('button', { name: /Double Elimination/ });
  await expect(doubleElim).toHaveAttribute('aria-pressed', 'false');
  await doubleElim.click();

  await expect(page.getByText('Settings updated')).toBeVisible();
  await expect(doubleElim).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await readTournament(tournament.id)).format).toBe('DOUBLE_ELIMINATION');
  // `type` mirrors `format` unless a caller sends its own.
  expect((await readTournament(tournament.id)).type).toBe('DOUBLE_ELIMINATION');
});

test('switching the team size persists', async ({ page }) => {
  const tournament = await settingsFixture(page);

  const twoVtwo = page.getByRole('button', { name: '2v2', exact: true });
  await expect(page.getByRole('button', { name: '5v5', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await twoVtwo.click();

  await expect(page.getByText('Settings updated')).toBeVisible();
  await expect(twoVtwo).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await readTournament(tournament.id)).teamSize).toBe(2);
});

test('the BO stage selects store numbers, and "None" stores null', async ({ page }) => {
  const tournament = await settingsFixture(page);

  // BO3 from the semi-finals = the last 2 rounds.
  await page.locator('#bo3-stage').selectOption({ label: 'Semi-Finals' });
  await expect(page.getByText('Settings updated')).toBeVisible();
  await expect.poll(async () => (await readTournament(tournament.id)).bo3LastRounds).toBe(2);

  // Reload between writes: each PATCH carries the row's updatedAt, so the next edit has to start
  // from the refreshed row rather than racing the refetch.
  await openSettings(page, tournament.id);
  await expect(page.locator('#bo3-stage')).toHaveValue('2');
  await page.locator('#bo5-stage').selectOption({ label: 'Grand Final' });
  await expect(page.getByText('Settings updated')).toBeVisible();
  await expect.poll(async () => (await readTournament(tournament.id)).bo5LastRounds).toBe(1);

  // Back to BO1: the UI's 0 is stored as null, not 0.
  await openSettings(page, tournament.id);
  await page.locator('#bo3-stage').selectOption({ label: 'None (BO1)' });
  await expect(page.getByText('Settings updated')).toBeVisible();
  await expect.poll(async () => (await readTournament(tournament.id)).bo3LastRounds).toBeNull();
  expect((await readTournament(tournament.id)).bo5LastRounds).toBe(1);
});

test('the third-place toggle persists', async ({ page }) => {
  const tournament = await settingsFixture(page);
  expect(tournament.hasThirdPlace).toBe(false);

  await page.getByRole('button', { name: 'Toggle third place match' }).click();

  await expect(page.getByText('Settings updated')).toBeVisible();
  await expect.poll(async () => (await readTournament(tournament.id)).hasThirdPlace).toBe(true);
});

test('the roster lock toggle persists and the card reports the new state', async ({ page }) => {
  const tournament = await settingsFixture(page);
  await expect(page.getByText('Editable').first()).toBeVisible();

  await page.getByRole('button', { name: 'Toggle roster lock' }).click();

  await expect(page.getByText('Settings updated')).toBeVisible();
  await expect.poll(async () => (await readTournament(tournament.id)).rosterLocked).toBe(true);
  await expect(page.getByText('Locked').first()).toBeVisible();
});

test('deleting from the danger zone needs the confirm and then really deletes', async ({ page }) => {
  const tournament = await settingsFixture(page);
  const dialogs: string[] = [];
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.message());
    void dialog.accept();
  });

  await page.getByRole('button', { name: 'Delete Tournament', exact: true }).click();

  expect(dialogs.join('\n')).toContain(`Delete "${tournament.name}" permanently?`);
  await expect(page).toHaveURL(/\/admin$/);
  await expect
    .poll(async () => (await readTournament(tournament.id).catch(() => null)) === null)
    .toBe(true);
});

test('dismissing the delete confirm leaves the tournament alone', async ({ page }) => {
  const tournament = await settingsFixture(page);
  page.on('dialog', (dialog) => void dialog.dismiss());

  await page.getByRole('button', { name: 'Delete Tournament', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Tournament Settings' })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/admin/tournaments/${tournament.id}`));
  expect((await readTournament(tournament.id)).name).toBe(tournament.name);
});
