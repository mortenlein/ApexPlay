import { expect, test, type Page } from '@playwright/test';
import { disposeApiContexts } from './helpers/api';
import { findTournamentByName } from './helpers/lan-seed';
import { loginAs } from './helpers/auth';

/**
 * The create-tournament wizard, driven the way an organizer drives it: six steps from the admin
 * dashboard, then the settings the review step promised have to be the settings in the database.
 *
 * Everything the wizard collects is a string (`'2'`, `'0'`, `'DOUBLE_ELIMINATION'`) and the create
 * route coerces it, so the assertions are deliberately on the stored row: `bo3LastRounds` 2 means
 * "BO3 from the semi-finals", `bo5LastRounds` 1 means "BO5 in the grand final", and `'0'` is
 * stored as null rather than 0.
 */
test.describe.configure({ mode: 'serial' });
test.afterEach(disposeApiContexts);

const uniqueName = (prefix: string) => `${prefix} ${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`;

/**
 * Open the wizard from the dashboard's own Create button (not the first-run coach's) and return
 * the modal, which the clicks are scoped to — the dashboard behind it has its own
 * "Create Tournament" buttons.
 */
async function openWizard(page: Page) {
  await loginAs(page, 'marcus');
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Select Game' })).toBeVisible();
  return page.locator('div.fixed.inset-0.z-\\[200\\]').last();
}

/** The tournament row the wizard wrote, once the create call has landed. */
async function createdTournament(name: string) {
  await expect
    .poll(async () => Boolean(await findTournamentByName(name)), { message: `no tournament named ${name}` })
    .toBe(true);
  return (await findTournamentByName(name))!;
}

test('the wizard walks all six steps and stores exactly the setup it reviewed', async ({ page }) => {
  const name = uniqueName('Wizard Cup');
  const wizard = await openWizard(page);

  // Step 1 — picking a game advances on its own.
  await page.getByRole('button', { name: /Counter-Strike 2/ }).click();
  await expect(page.getByRole('heading', { name: 'Tournament Details' })).toBeVisible();

  // Step 2 — identity.
  await page.getByPlaceholder('e.g. Winter Invitational 2024').fill(name);
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 3 — format, team size, third place.
  await expect(page.getByRole('heading', { name: 'Format & Rules' })).toBeVisible();
  const doubleElim = page.getByRole('button', { name: /Double Elimination/ });
  await doubleElim.click();
  const fiveVfive = page.getByRole('button', { name: '5v5', exact: true });
  await fiveVfive.click();
  // The selected option is marked with the action border — the only affordance the wizard has.
  await expect(doubleElim).toHaveClass(/border-\[var\(--mds-action\)\]/);
  await expect(fiveVfive).toHaveClass(/border-\[var\(--mds-action\)\]/);
  // The toggle is a bare switch; the card it lives in names it.
  await page.locator('.mds-card').filter({ hasText: '3rd Place Match' }).last().getByRole('button').click();
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 4 — series rules. Both selects are "last N rounds counted back from the final".
  await expect(page.getByRole('heading', { name: 'Series Rules' })).toBeVisible();
  const selects = page.locator('select');
  await selects.nth(0).selectOption({ label: 'Semi-Finals' });
  await selects.nth(1).selectOption({ label: 'Grand Final' });
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 5 — review. This is the organizer's last look at the setup, so it must be right.
  await expect(page.getByRole('heading', { name: 'Review Setup' })).toBeVisible();
  await expect(page.getByRole('heading', { name })).toBeVisible();
  await expect(page.getByText('DOUBLE ELIMINATION')).toBeVisible();
  for (const [label, value] of [
    ['Format Style', 'Double'],
    ['Decider Match', 'Active'],
    ['BO3 From', 'Semi-Finals'],
    ['BO5 From', 'Grand Final'],
  ] as const) {
    await expect(page.getByText(label, { exact: true }).locator('..')).toContainText(value);
  }

  await wizard.getByRole('button', { name: 'Create Tournament' }).click();

  // Step 6 — the share link, which is the whole point of finishing the wizard.
  await expect(page.getByRole('heading', { name: 'Tournament Live' })).toBeVisible();
  const tournament = await createdTournament(name);
  await expect(page.getByText(`/tournaments/${tournament.id}`)).toBeVisible();

  expect(tournament).toMatchObject({
    name,
    game: 'CS2',
    category: 'BRACKET',
    format: 'DOUBLE_ELIMINATION',
    type: 'DOUBLE_ELIMINATION',
    teamSize: 5,
    bo3LastRounds: 2,
    bo5LastRounds: 1,
    hasThirdPlace: true,
    // Players self-register via Steam unless the organizer turns it off in settings.
    steamSignupEnabled: true,
    rosterLocked: false,
  });
});

test('going back and changing the game drops a team size the new game does not support', async ({ page }) => {
  const name = uniqueName('Game Swap Cup');
  const wizard = await openWizard(page);

  // CS2 offers 2v2 and 5v5; take the 5v5 default through to the format step.
  await page.getByRole('button', { name: /Counter-Strike 2/ }).click();
  await page.getByPlaceholder('e.g. Winter Invitational 2024').fill(name);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('button', { name: '5v5', exact: true })).toHaveClass(/border-\[var\(--mds-action\)\]/);

  // Back to the game step and over to Fortnite, whose sizes are 1-4 — 5v5 cannot survive.
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { name: 'Select Game' })).toBeVisible();
  await page.getByRole('button', { name: /Fortnite/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('heading', { name: 'Format & Rules' })).toBeVisible();
  await expect(page.getByRole('button', { name: '5v5', exact: true })).toHaveCount(0);
  for (const label of ['Solo', 'Duos', 'Trios', 'Squads']) {
    await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
  }
  // Squads (4) is Fortnite's default, and it is the one now selected.
  await expect(page.getByRole('button', { name: 'Squads', exact: true })).toHaveClass(/border-\[var\(--mds-action\)\]/);

  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await wizard.getByRole('button', { name: 'Create Tournament' }).click();
  await expect(page.getByRole('heading', { name: 'Tournament Live' })).toBeVisible();

  // The server never saw the impossible pairing (it would have answered 400).
  expect(await createdTournament(name)).toMatchObject({ game: 'FORTNITE', teamSize: 4, category: 'BATTLE_ROYALE' });
});
