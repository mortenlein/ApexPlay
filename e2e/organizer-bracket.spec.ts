import { expect, test, type Page } from '@playwright/test';
import { apiAs, disposeApiContexts } from './helpers/api';
import { createSeededTeams, createTournament, readMatches, readTournament } from './helpers/lan-seed';
import { loginAs } from './helpers/auth';

/**
 * Generating and regenerating the bracket from the organizer's own screens.
 *
 * Generating is the moment a tournament stops being editable: the route locks the roster on its
 * way out, which is why the second pass has to be unlocked first and why the only regenerate
 * controls left are the overview's (gated on the lock) and the dashboard's Schedule action (which
 * overrides it). Both dialogs are checked, because "rebuild the bracket" destroys results.
 */
test.describe.configure({ mode: 'serial' });
test.afterEach(disposeApiContexts);

const uniqueName = (prefix: string) => `${prefix} ${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`;

/** The stage stepper's single "what's next" action, whatever stage it currently reports. */
function stepperAction(page: Page) {
  return page.locator('ol').locator('..').getByRole('button');
}

/** A games column of the control cockpit ("Now" / "Up next" / "Completed"). */
function gamesSection(page: Page, title: string) {
  return page.locator('div.space-y-2').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
}

async function openTab(page: Page, tournamentId: string, tab: string) {
  await page.goto(`/admin/tournaments/${tournamentId}?tab=${tab}`);
}

/** Eight seeded teams, ready to bracket. */
async function eightTeamTournament() {
  const tournament = await createTournament({ name: uniqueName('Bracket Cup'), teamSize: 5 });
  const teams = await createSeededTeams(tournament.id, 8);
  return { tournament, teams };
}

test('generating from the stage stepper fills the matches and control views', async ({ page }) => {
  const { tournament } = await eightTeamTournament();
  await loginAs(page, 'marcus');
  await openTab(page, tournament.id, 'control');

  // Teams are in, nothing is scheduled: the stepper asks for the bracket.
  await expect(page.getByText('Registration')).toBeVisible();
  await expect(stepperAction(page)).toContainText('Generate bracket');
  await expect(page.getByText('No bracket yet — generate it from Matches once teams are seeded.')).toBeVisible();

  const dialogs: string[] = [];
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.message());
    void dialog.accept();
  });
  await stepperAction(page).click();

  await expect(page.getByText('Bracket generated')).toBeVisible();
  expect(dialogs.join('\n')).toContain('locks roster edits');
  // 8 teams single elimination: 4 + 2 + 1.
  await expect.poll(async () => (await readMatches(tournament.id)).length).toBe(7);
  expect((await readTournament(tournament.id)).rosterLocked).toBe(true);

  // The cockpit queues the four playable first-round games, and the stepper has moved on.
  await expect(gamesSection(page, 'Up next').getByRole('button')).toHaveCount(4);
  await expect(stepperAction(page)).toContainText('Open control');

  // The matches tab shows one card per generated match.
  await page.getByRole('button', { name: 'Matches' }).click();
  await expect(page.getByRole('heading', { name: 'Tournament Matches' })).toBeVisible();
  await expect(page.locator('[data-testid^="match-card-"]')).toHaveCount(7);
  // With a bracket in place, deploying again from here is closed off.
  await expect(page.getByRole('button', { name: 'Deploy Brackets' })).toBeDisabled();
});

test('regenerating waits for the roster lock to come off and then rebuilds every match', async ({ page }) => {
  const { tournament } = await eightTeamTournament();
  const api = await apiAs('marcus');
  expect((await api.post(`/api/tournaments/${tournament.id}/generate`, { data: {} })).status()).toBe(200);
  const firstIds = (await readMatches(tournament.id)).map((match) => match.id);
  expect(firstIds).toHaveLength(7);

  await loginAs(page, 'marcus');
  await openTab(page, tournament.id, 'overview');

  // Generating locked the roster, so the regenerate button is held shut and says why.
  const regenerate = page.getByRole('button', { name: 'Regenerate Bracket' });
  await expect(regenerate).toBeDisabled();
  await expect(page.getByText('Bracket safety lock enabled')).toBeVisible();

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Toggle roster lock' }).click();
  await expect(page.getByText('Settings updated')).toBeVisible();
  await expect.poll(async () => (await readTournament(tournament.id)).rosterLocked).toBe(false);

  await page.getByRole('button', { name: 'Overview' }).click();
  const dialogs: string[] = [];
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.message());
    void dialog.accept();
  });
  await expect(regenerate).toBeEnabled();
  await regenerate.click();

  await expect(page.getByText('Bracket regenerated')).toBeVisible();
  expect(dialogs.join('\n')).toContain('Regenerate bracket now?');
  expect(dialogs.join('\n')).toContain('regenerate bracket rounds');

  // Rebuilt from scratch: same shape, all-new rows, and the roster is locked again.
  await expect
    .poll(async () => {
      const ids = (await readMatches(tournament.id)).map((match) => match.id);
      return ids.length === 7 && ids.every((id) => !firstIds.includes(id));
    })
    .toBe(true);
  expect((await readTournament(tournament.id)).rosterLocked).toBe(true);
});

test('the dashboard Schedule action warns that existing results are deleted', async ({ page }) => {
  const { tournament } = await eightTeamTournament();
  const api = await apiAs('marcus');
  expect((await api.post(`/api/tournaments/${tournament.id}/generate`, { data: {} })).status()).toBe(200);
  const firstIds = (await readMatches(tournament.id)).map((match) => match.id);

  await loginAs(page, 'marcus');
  await page.goto('/admin');
  const card = page.locator('.mds-card').filter({ hasText: tournament.name });
  await expect(card).toContainText('8 teams, 7 matches');

  const dialogs: string[] = [];
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.message());
    void dialog.accept();
  });
  await card.getByRole('button', { name: 'Schedule' }).click();

  await expect(page.getByText('Bracket regenerated')).toBeVisible();
  expect(dialogs.join('\n')).toBe(
    'This will delete all existing matches and results and rebuild the bracket. Continue?'
  );
  // The dashboard path passes overrideLock, so the locked roster does not stop it.
  await expect
    .poll(async () => {
      const ids = (await readMatches(tournament.id)).map((match) => match.id);
      return ids.length === 7 && ids.every((id) => !firstIds.includes(id));
    })
    .toBe(true);
});
