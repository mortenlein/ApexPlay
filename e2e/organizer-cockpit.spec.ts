import { expect, test, type Page } from '@playwright/test';
import { apiAnon, apiAs, disposeApiContexts, json } from './helpers/api';
import { createCallableMatch, readMatch, readTournament } from './helpers/lan-seed';
import { E2E_BASE_URL, loginAs } from './helpers/auth';

/**
 * The control cockpit — the one screen an organizer runs the event from: rosters on the left, the
 * bracket in the middle, and the games grouped into Now / Up next / Completed on the right, with
 * the EON live-score bridge above them.
 *
 * "Now" deliberately means called *or* live: a called match is the thing needing attention, so it
 * must not be buried in the queue. The check-in ticks are read off the matches payload (the teams
 * payload carries no `checkedInAt`), which is why the marshal's check-in has to show up here.
 */
test.describe.configure({ mode: 'serial' });
test.afterEach(disposeApiContexts);

/** A games column of the cockpit, addressed by its heading. */
function gamesSection(page: Page, title: string) {
  return page.locator('div.space-y-2').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
}

/**
 * The cockpit on a tall window: opening a match editor from here needs one, because that modal
 * has no height cap of its own (see the fixme in organizer-match-modal.spec.ts).
 */
async function openControl(page: Page, tournamentId: string) {
  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.goto(`/admin/tournaments/${tournamentId}?tab=control`);
  await expect(page.getByRole('heading', { name: 'Teams & rosters' })).toBeVisible();
}

test('calling a match from the editor moves it into Now, and a result moves it to Completed', async ({ page }) => {
  const { tournament, match, home, away } = await createCallableMatch();
  await loginAs(page, 'marcus');
  await openControl(page, tournament.id);

  // Not called yet: it sits in the queue, and Now is empty.
  await expect(gamesSection(page, 'Up next').getByRole('button')).toHaveCount(1);
  await expect(gamesSection(page, 'Now')).toContainText('Nothing called or live.');

  await gamesSection(page, 'Up next').getByRole('button').click();
  const modal = page.locator('div.fixed.inset-0.z-\\[300\\]');
  await expect(modal.getByRole('heading', { name: 'Match Controls' })).toBeVisible();
  await modal.getByTestId('start-match-button').click();

  await expect(page.getByText('Match called', { exact: true })).toBeVisible();
  await expect.poll(async () => (await readMatch(match.id)).status).toBe('READY');
  await modal.locator('header button').click();

  const nowGroup = gamesSection(page, 'Now');
  await expect(nowGroup.getByRole('button')).toHaveCount(1);
  await expect(nowGroup).toContainText(home.name);
  await expect(nowGroup).toContainText(away.name);
  await expect(nowGroup).toContainText('Called');
  await expect(gamesSection(page, 'Up next')).toContainText('Nothing queued');

  // Once it is played it belongs to the third column.
  const api = await apiAs('marcus');
  expect((await api.post(`/api/matches/${match.id}`, { data: { homeScore: 1, awayScore: 0 } })).status()).toBe(200);
  await openControl(page, tournament.id);
  await expect(gamesSection(page, 'Completed').getByRole('button')).toHaveCount(1);
  await expect(gamesSection(page, 'Completed')).toContainText(home.name);
  await expect(gamesSection(page, 'Now')).toContainText('Nothing called or live.');
});

test('a marshal check-in shows up as a tick on the roster card', async ({ page }) => {
  const { tournament, home } = await createCallableMatch();
  const playerId = home.players[0].id;
  await loginAs(page, 'marcus');
  await openControl(page, tournament.id);

  const tick = page.locator('[title="Checked in at seat by floor staff"]');
  // The roster card prefers the in-game name ("Homie") over the legal one.
  await expect(page.getByText('Homie')).toBeVisible();
  await expect(tick).toHaveCount(0);

  // Floor staff, not the organizer, do the checking in.
  const mia = await apiAs('mia');
  const checkedIn = await mia.post(`/api/players/${playerId}/checkin`, { data: { checkedIn: true } });
  expect(checkedIn.status()).toBe(200);

  await openControl(page, tournament.id);
  await expect(tick).toHaveCount(1);
  // The seat label is right there beside it, which is the pair a marshal is read out to.
  await expect(page.getByText('A12')).toBeVisible();
});

test('the EON bridge panel enables, rotates and disables the live-score credential', async ({ page }) => {
  const { tournament } = await createCallableMatch();
  await loginAs(page, 'marcus');
  await openControl(page, tournament.id);

  const panel = page.locator('.mds-card').filter({ hasText: 'EON live scores' }).last();
  await expect(panel).toContainText('Off');
  await expect(panel.getByRole('button', { name: 'Enable bridge' })).toBeVisible();

  await panel.getByRole('button', { name: 'Enable bridge' }).click();

  // Enabled: the operator gets the endpoint to paste into EON plus the bearer token to go with it.
  await expect(panel).toContainText('On');
  await expect(panel.getByText(`${E2E_BASE_URL}/api/webhooks/eon`)).toBeVisible();
  const tokenField = panel.locator('code').filter({ hasText: /^eon_/ });
  await expect(tokenField).toBeVisible();
  const firstToken = (await tokenField.textContent())!.trim();
  expect(firstToken).toMatch(/^eon_[0-9a-f]{40}$/);
  expect((await readTournament(tournament.id)).eonBridgeToken).toBe(firstToken);

  await panel.getByRole('button', { name: 'Rotate token' }).click();
  await expect.poll(async () => (await tokenField.textContent())!.trim()).not.toBe(firstToken);
  const rotated = (await tokenField.textContent())!.trim();
  expect(rotated).toMatch(/^eon_[0-9a-f]{40}$/);
  expect((await readTournament(tournament.id)).eonBridgeToken).toBe(rotated);

  await panel.getByRole('button', { name: 'Disable' }).click();
  await expect(panel).toContainText('Off');
  await expect(panel.locator('code').filter({ hasText: /^eon_/ })).toHaveCount(0);
  await expect(panel.getByRole('button', { name: 'Enable bridge' })).toBeVisible();
  await expect.poll(async () => (await readTournament(tournament.id)).eonBridgeToken).toBeNull();
});

test('the EON token is admin-only: a player reading the tournament never sees it', async ({ page }) => {
  const { tournament } = await createCallableMatch();
  await loginAs(page, 'marcus');
  await openControl(page, tournament.id);

  const panel = page.locator('.mds-card').filter({ hasText: 'EON live scores' }).last();
  await panel.getByRole('button', { name: 'Enable bridge' }).click();
  await expect(panel).toContainText('On');
  const token = (await readTournament(tournament.id)).eonBridgeToken;
  expect(token).toMatch(/^eon_/);

  // The organizer's own read carries it (that is where the panel gets it from).
  const marcus = await apiAs('marcus');
  expect(await json(await marcus.get(`/api/tournaments/${tournament.id}`))).toMatchObject({ eonBridgeToken: token });

  // A player's read, and an anonymous one, must not carry the key at all.
  for (const context of [await apiAs('leo'), await apiAnon()]) {
    const response = await context.get(`/api/tournaments/${tournament.id}`);
    expect(response.status()).toBe(200);
    const body = await json<Record<string, unknown>>(response);
    expect(body.id).toBe(tournament.id);
    expect('eonBridgeToken' in body).toBe(false);
    expect(JSON.stringify(body)).not.toContain(token);
  }

  // Neither may they ask the bridge route itself.
  const leo = await apiAs('leo');
  expect((await leo.get(`/api/tournaments/${tournament.id}/eon-bridge`)).status()).toBe(401);
});
