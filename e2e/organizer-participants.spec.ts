import { expect, test, type Locator, type Page } from '@playwright/test';
import { apiAs, disposeApiContexts, json } from './helpers/api';
import { createSeededTeams, createTeam, createTournament, readMatches, readTeam, readTeams } from './helpers/lan-seed';
import { loginAs } from './helpers/auth';

/**
 * The Teams tab: registering a roster, correcting it in the team editor, and removing a team —
 * all through the organizer's browser.
 *
 * The lock semantics are the interesting part and they are deliberately asymmetric: once the
 * bracket is generated (which locks the roster) the LAN floor still has to be able to fix a seat
 * or a misspelled name, while the fields that change *who* is playing (Steam ID) or *who speaks
 * for the team* (leader) are closed, and removing a team becomes a forced pull-out that empties
 * its bracket slots.
 */
test.describe.configure({ mode: 'serial' });
test.afterEach(disposeApiContexts);

const uniqueName = (prefix: string) => `${prefix} ${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`;

async function openParticipants(page: Page, tournamentId: string) {
  await page.goto(`/admin/tournaments/${tournamentId}?tab=participants`);
  await expect(page.getByRole('heading', { name: 'Register Team' })).toBeVisible();
}

/** The team editor, opened from the row's own edit button. */
async function openTeamEditor(page: Page, teamName: string) {
  await page.getByRole('button', { name: `Edit ${teamName}` }).click();
  await expect(page.getByRole('heading', { name: 'Team details' })).toBeVisible();
  return page.locator('div.fixed.inset-0.z-\\[300\\]');
}

/**
 * One roster row of the editor, found through the remove button that names its player — the rows
 * carry no test id and are otherwise identical.
 */
function playerRow(modal: Locator, playerName: string): Locator {
  return modal
    .getByRole('button', { name: `Remove ${playerName}`, exact: true })
    .locator('xpath=ancestor::div[contains(@class,"mds-card")][1]');
}

test('registering a team through the form stores the roster with its seats', async ({ page }) => {
  const tournament = await createTournament({ name: uniqueName('Registration Cup'), teamSize: 5 });
  await loginAs(page, 'marcus');
  await openParticipants(page, tournament.id);

  const roster = [
    { name: 'Ada Lovelace', nick: 'ada', seat: 'A01' },
    { name: 'Grace Hopper', nick: 'grace', seat: 'A02' },
    { name: 'Alan Turing', nick: 'alan', seat: 'A03' },
    { name: 'Katherine Johnson', nick: 'kate', seat: 'A04' },
    { name: 'Linus Torvalds', nick: 'linus', seat: 'A05' },
  ];

  await page.getByPlaceholder('Enter team name').fill('Bit Crushers');
  await page.getByPlaceholder('Seed position').fill('3');
  // The form always offers `teamSize` rows: row 1 is the captain row, the rest are plain.
  await page.getByPlaceholder('Player name (captain)').fill(roster[0].name);
  for (const [index, player] of roster.slice(1).entries()) {
    await page.getByPlaceholder('Player name', { exact: true }).nth(index).fill(player.name);
  }
  for (const [index, player] of roster.entries()) {
    await page.getByPlaceholder('Nick').nth(index).fill(player.nick);
    await page.getByPlaceholder('Seat').nth(index).fill(player.seat);
  }
  await expect(page.getByText(`Roster (${roster.length}/${roster.length})`)).toBeVisible();

  // `exact` keeps this off the stage stepper's "Add teams" call to action.
  await page.getByRole('button', { name: 'Add Team', exact: true }).click();

  await expect(page.getByText('Team added')).toBeVisible();
  await expect.poll(async () => (await readTeams(tournament.id)).length).toBe(1);
  const [stored] = await readTeams(tournament.id);
  expect(stored).toMatchObject({ name: 'Bit Crushers', seed: 3 });
  expect(stored.players.map((player) => [player.name, player.nickname, player.seating])).toEqual(
    [...roster]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((player) => [player.name, player.nick, player.seat])
  );
  // The list picks the new team up, and the form is cleared for the next one.
  await expect(page.getByText('1 registered')).toBeVisible();
  await expect(page.getByPlaceholder('Enter team name')).toHaveValue('');
});

test('the team editor renames the team and moves a player to another seat', async ({ page }) => {
  const tournament = await createTournament({ name: uniqueName('Editor Cup'), teamSize: 5 });
  const team = await createTeam(tournament.id, {
    name: 'Old Guard',
    seed: 1,
    players: [{ name: 'Sam Seat', seating: 'A01', isLeader: true }],
  });
  await loginAs(page, 'marcus');
  await openParticipants(page, tournament.id);

  const modal = await openTeamEditor(page, 'Old Guard');
  await modal.getByPlaceholder('Team name').fill('New Guard');
  await modal.getByRole('button', { name: 'Save details' }).click();
  await expect(page.getByText('Team saved')).toBeVisible();
  await expect.poll(async () => (await readTeam(team.id))!.name).toBe('New Guard');

  const row = playerRow(modal, 'Sam Seat');
  await row.getByPlaceholder('A-12').fill('C14');
  await row.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByText('Player saved')).toBeVisible();
  await expect.poll(async () => (await readTeam(team.id))!.players[0].seating).toBe('C14');
  await expect(modal.getByText('All changes saved')).toBeVisible();
});

test('the team editor adds players up to the team-size cap and then refuses more', async ({ page }) => {
  const tournament = await createTournament({ name: uniqueName('Cap Cup'), teamSize: 2 });
  const team = await createTeam(tournament.id, {
    name: 'Duo Squad',
    seed: 1,
    players: [{ name: 'First Player', seating: 'B01', isLeader: true }],
  });
  await loginAs(page, 'marcus');
  await openParticipants(page, tournament.id);

  const modal = await openTeamEditor(page, 'Duo Squad');
  await expect(modal.getByRole('heading', { name: 'Active roster (1/2)' })).toBeVisible();

  const addPlayer = modal.getByRole('button', { name: 'Add player' });
  await addPlayer.click();
  // The draft row is identified by its own commit button, not by position among the saved rows.
  const draftRow = modal
    .getByRole('button', { name: 'Add to roster' })
    .locator('xpath=ancestor::div[contains(@class,"mds-card")][1]');
  await draftRow.getByPlaceholder('Full name').fill('Second Player');
  await draftRow.getByPlaceholder('A-12').fill('B02');
  await modal.getByRole('button', { name: 'Add to roster' }).click();

  await expect(page.getByText('Player added')).toBeVisible();
  await expect(modal.getByRole('heading', { name: 'Active roster (2/2)' })).toBeVisible();
  await expect.poll(async () => (await readTeam(team.id))!.players.length).toBe(2);
  expect((await readTeam(team.id))!.players.map((p) => [p.name, p.seating])).toContainEqual(['Second Player', 'B02']);

  // Full roster: the organizer is told why, rather than being allowed a 400 from the server.
  await expect(addPlayer).toBeDisabled();
  await expect(addPlayer).toHaveAttribute('title', 'Roster is full (2 players)');
});

test('the team editor removes a player and hands the leader badge to another', async ({ page }) => {
  const tournament = await createTournament({ name: uniqueName('Roster Cup'), teamSize: 5 });
  const team = await createTeam(tournament.id, {
    name: 'Rotation Crew',
    seed: 1,
    players: [
      { name: 'Captain One', seating: 'D01', isLeader: true },
      { name: 'Bench Two', seating: 'D02' },
      { name: 'Promoted Three', seating: 'D03' },
    ],
  });
  await loginAs(page, 'marcus');
  await openParticipants(page, tournament.id);
  page.on('dialog', (dialog) => void dialog.accept());

  const modal = await openTeamEditor(page, 'Rotation Crew');
  await playerRow(modal, 'Bench Two').getByRole('button', { name: 'Remove Bench Two' }).click();

  await expect(page.getByText('Player removed')).toBeVisible();
  await expect.poll(async () => (await readTeam(team.id))!.players.map((p) => p.name)).toEqual([
    'Captain One',
    'Promoted Three',
  ]);

  const promoted = playerRow(modal, 'Promoted Three');
  await promoted.getByRole('button', { name: 'Not leader' }).click();
  await expect(promoted.getByRole('button', { name: 'Team leader' })).toBeVisible();
  await promoted.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByText('Player saved')).toBeVisible();
  await expect
    .poll(async () => (await readTeam(team.id))!.players.find((p) => p.name === 'Promoted Three')!.isLeader)
    .toBe(true);
});

test('removing a team from the list takes it out of the tournament', async ({ page }) => {
  const tournament = await createTournament({ name: uniqueName('Removal Cup'), teamSize: 5 });
  const teams = await createSeededTeams(tournament.id, 2);
  await loginAs(page, 'marcus');
  await openParticipants(page, tournament.id);

  const dialogs: string[] = [];
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.message());
    void dialog.accept();
  });

  await expect(page.getByText('2 registered')).toBeVisible();
  await page.getByRole('button', { name: `Remove ${teams[1].name}` }).click();

  await expect(page.getByText('Team removed')).toBeVisible();
  expect(dialogs.join('\n')).toContain(`Remove ${teams[1].name} from this tournament?`);
  await expect.poll(async () => (await readTeams(tournament.id)).map((t) => t.name)).toEqual([teams[0].name]);
  await expect(page.getByText('1 registered')).toBeVisible();
});

test('a locked roster still takes seat fixes but closes Steam ID and leader edits', async ({ page }) => {
  const tournament = await createTournament({ name: uniqueName('Locked Cup'), teamSize: 5 });
  const teams = await createSeededTeams(tournament.id, 4);
  // Generating the bracket is what locks the roster in the first place.
  const api = await apiAs('marcus');
  expect((await api.post(`/api/tournaments/${tournament.id}/generate`, { data: {} })).status()).toBe(200);

  await loginAs(page, 'marcus');
  await openParticipants(page, tournament.id);
  await expect(page.getByText(/Roster edits are locked because the bracket is already in play/)).toBeVisible();

  const modal = await openTeamEditor(page, teams[0].name);
  await expect(modal.getByText('Roster locked')).toBeVisible();
  const row = playerRow(modal, 'Player 1');

  // Closed: identity fields, with the reason on the control itself.
  const steamIdField = row.getByPlaceholder('7656119...');
  await expect(steamIdField).toBeDisabled();
  await expect(steamIdField).toHaveAttribute('title', 'Unlock roster edits to change Steam IDs');
  const leaderToggle = row.getByRole('button', { name: 'Team leader' });
  await expect(leaderToggle).toBeDisabled();
  await expect(leaderToggle).toHaveAttribute('title', 'Unlock roster edits to change the team leader');
  await expect(modal.getByText(/Seeding, Steam IDs, leader flags and roster additions\/removals/)).toBeVisible();

  // Open: the floor correction the marshal actually needs.
  await row.getByPlaceholder('A-12').fill('Z99');
  await row.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Player saved')).toBeVisible();
  await expect.poll(async () => (await readTeam(teams[0].id))!.players[0].seating).toBe('Z99');
  expect((await readTeam(teams[0].id))!.players[0].isLeader).toBe(true);
});

test('force-removing a locked team pulls it out of its matches', async ({ page }) => {
  const tournament = await createTournament({ name: uniqueName('Force Cup'), teamSize: 5 });
  const teams = await createSeededTeams(tournament.id, 4);
  const api = await apiAs('marcus');
  const generated = await api.post(`/api/tournaments/${tournament.id}/generate`, { data: {} });
  expect(generated.status()).toBe(200);
  await json(generated);

  const doomed = teams[0];
  const placedBefore = (await readMatches(tournament.id)).filter(
    (match) => match.homeTeamId === doomed.id || match.awayTeamId === doomed.id
  );
  expect(placedBefore).not.toHaveLength(0);

  await loginAs(page, 'marcus');
  await openParticipants(page, tournament.id);
  const dialogs: string[] = [];
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.message());
    void dialog.accept();
  });

  await page.getByRole('button', { name: `Remove ${doomed.name}` }).click();

  await expect(page.getByText('Team removed')).toBeVisible();
  // The locked dialog is explicit that this is a forced pull-out, not a tidy removal.
  expect(dialogs.join('\n')).toContain(`Force-remove ${doomed.name} while the bracket is live?`);
  await expect.poll(async () => await readTeam(doomed.id)).toBeNull();
  await expect(page.getByText(doomed.name)).toHaveCount(0);

  const placedAfter = (await readMatches(tournament.id)).filter(
    (match) => match.homeTeamId === doomed.id || match.awayTeamId === doomed.id
  );
  expect(placedAfter).toHaveLength(0);
});
