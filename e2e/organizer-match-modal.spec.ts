import { expect, test, type Page } from '@playwright/test';
import { apiAs, disposeApiContexts } from './helpers/api';
import { createSeededTeams, createTournament, readMatch, readMatches, readTeams } from './helpers/lan-seed';
import { loginAs } from './helpers/auth';

/**
 * The match editor the organizer actually scores with: series length, per-map scores, forfeits,
 * and the one refusal that matters on a LAN — a feeder result cannot be rewritten once the match
 * it feeds has started, or a team would be yanked out of a live game.
 *
 * The modal has no test ids on its inputs, but its number fields are in a fixed document order
 * (series home, series away, then map 1..N as home/away pairs), which is how they are addressed
 * here.
 */
test.describe.configure({ mode: 'serial' });
test.afterEach(disposeApiContexts);

const uniqueName = (prefix: string) => `${prefix} ${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`;

/** A generated four-team bracket: two semi-finals feeding one final. */
async function fourTeamBracket() {
  const tournament = await createTournament({ name: uniqueName('Scoring Cup'), teamSize: 5 });
  await createSeededTeams(tournament.id, 4);
  const api = await apiAs('marcus');
  expect((await api.post(`/api/tournaments/${tournament.id}/generate`, { data: {} })).status()).toBe(200);

  const matches = await readMatches(tournament.id);
  expect(matches).toHaveLength(3);
  const semis = matches.filter((match) => match.round === 1).sort((a, b) => a.matchOrder - b.matchOrder);
  const final = matches.find((match) => match.round === 2)!;
  const teams = await readTeams(tournament.id);
  const nameOf = (teamId: string | null) => teams.find((team) => team.id === teamId)!.name;

  return { api, tournament, semis, final, nameOf };
}

/**
 * The editor is a tall modal with no height cap of its own, so these tests run on a tall window
 * — at 1280x720 its own buttons sit below the fold and cannot be scrolled to. That is a real
 * layout bug, pinned by the "fits a laptop window" fixme at the bottom of this file.
 */
async function openMatchesTab(page: Page, tournamentId: string) {
  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.goto(`/admin/tournaments/${tournamentId}?tab=matches`);
  await expect(page.getByRole('heading', { name: 'Tournament Matches' })).toBeVisible();
}

/** Open one match's editor from its card and return the modal. */
async function openMatchModal(page: Page, matchId: string) {
  await page.getByTestId(`match-card-${matchId}`).click();
  const modal = page.locator('div.fixed.inset-0.z-\\[300\\]');
  await expect(modal.getByRole('heading', { name: 'Match Controls' })).toBeVisible();
  return modal;
}

test('a BO3 scored map by map completes the match and advances the winner', async ({ page }) => {
  const { semis, final, nameOf } = await fourTeamBracket();
  const [semiA] = semis;
  await loginAs(page, 'marcus');
  await openMatchesTab(page, semis[0].tournamentId);

  const modal = await openMatchModal(page, semiA.id);
  await modal.getByRole('combobox').selectOption('3');

  // Series score first, then the three map scorelines in document order.
  const numbers = modal.locator('input[type="number"]');
  await expect(numbers).toHaveCount(8);
  for (const [index, value] of ['2', '1', '16', '14', '13', '16', '16', '10'].entries()) {
    await numbers.nth(index).fill(value);
  }
  await modal.getByRole('button', { name: 'Update Match Data' }).click();

  await expect(page.getByText('Match saved')).toBeVisible();
  await expect(modal).toHaveCount(0);

  const played = await readMatch(semiA.id);
  expect(played).toMatchObject({
    status: 'COMPLETED',
    bestOf: 3,
    // Always derived from bestOf: first to 2 maps.
    scoreLimit: 2,
    homeScore: 2,
    awayScore: 1,
    winnerId: semiA.homeTeamId,
    resultType: null,
  });
  expect(JSON.parse(String(played.mapScores))).toMatchObject([
    { home: 16, away: 14 },
    { home: 13, away: 16 },
    { home: 16, away: 10 },
  ]);

  // The winner is in the final, and the final's own editor shows them.
  await expect.poll(async () => (await readMatch(final.id)).homeTeamId).toBe(semiA.homeTeamId);
  const finalModal = await openMatchModal(page, final.id);
  await expect(finalModal.getByText(nameOf(semiA.homeTeamId), { exact: true })).toBeVisible();
});

test('a forfeit recorded in the modal hands the match to the other team', async ({ page }) => {
  const { semis, nameOf } = await fourTeamBracket();
  const semiB = semis[1];
  await loginAs(page, 'marcus');
  await openMatchesTab(page, semiB.tournamentId);

  const dialogs: string[] = [];
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.message());
    void dialog.accept();
  });

  const modal = await openMatchModal(page, semiB.id);
  await modal.getByTestId('forfeit-away-button').click();

  await expect(page.getByText('Match saved')).toBeVisible();
  expect(dialogs.join('\n')).toContain(`Record a forfeit for ${nameOf(semiB.awayTeamId)}?`);
  expect(dialogs.join('\n')).toContain(`${nameOf(semiB.homeTeamId)} is declared the winner and advances.`);

  const walkover = await readMatch(semiB.id);
  expect(walkover).toMatchObject({
    status: 'COMPLETED',
    resultType: 'FORFEIT',
    winnerId: semiB.homeTeamId,
    // The server fills in the walkover scoreline in the winner's favour.
    homeScore: 1,
    awayScore: 0,
  });

  // The card carries the result, so the organizer can at least see it was decided.
  await expect(page.getByTestId(`match-card-${semiB.id}`)).toContainText('Done');
});

/**
 * BUG: the walkover badge in the match editor is not durable. `EditMatchModal` renders it from
 * `match.resultType` (src/components/tournament/manage/EditMatchModal.tsx:33), but neither list
 * payload the workspace reads carries that column — not the route
 * (src/app/api/tournaments/[id]/matches/route.ts:40-57, its `select` stops at `mapScores`) nor the
 * SSR prefetch it mirrors (src/lib/api.ts:182-221). The badge is only ever visible for as long as
 * the SSE row that `useMatchStream` merges in survives, i.e. until the next refetch: reload the
 * page and a forfeited match is indistinguishable from one won 1:0.
 */
test('a reopened forfeit still says it was a forfeit', async ({ page }) => {
  const { api, semis } = await fourTeamBracket();
  const semiB = semis[1];
  expect((await api.post(`/api/matches/${semiB.id}`, { data: { forfeit: 'AWAY' } })).status()).toBe(200);
  expect((await readMatch(semiB.id)).resultType).toBe('FORFEIT');

  await loginAs(page, 'marcus');
  await openMatchesTab(page, semiB.tournamentId);
  const modal = await openMatchModal(page, semiB.id);

  const titleRow = modal.getByRole('heading', { name: 'Match Controls' }).locator('..');
  await expect(titleRow.getByText('Forfeit', { exact: true })).toBeVisible();
});

test('rewriting a feeder result after the final has started is refused, and nothing moves', async ({ page }) => {
  const { api, semis, final } = await fourTeamBracket();
  const [semiA] = semis;

  // The semi is played and its winner is in the final, which then goes live.
  expect((await api.post(`/api/matches/${semiA.id}`, { data: { bestOf: 3, homeScore: 2, awayScore: 0 } })).status()).toBe(200);
  expect((await readMatch(final.id)).homeTeamId).toBe(semiA.homeTeamId);
  expect((await api.post(`/api/matches/${final.id}`, { data: { status: 'LIVE' } })).status()).toBe(200);

  await loginAs(page, 'marcus');
  await openMatchesTab(page, semiA.tournamentId);
  const modal = await openMatchModal(page, semiA.id);

  // Flip the result the other way round: the away team "actually" won.
  const numbers = modal.locator('input[type="number"]');
  await numbers.nth(0).fill('0');
  await numbers.nth(1).fill('2');
  await modal.getByRole('button', { name: 'Update Match Data' }).click();

  await expect(page.getByText('Match not saved')).toBeVisible();
  await expect(
    page.getByText(`Downstream match ${final.id.slice(0, 8)} has already started — reset it first.`)
  ).toBeVisible();
  // The editor stays open on the rejected edit.
  await expect(modal.getByRole('heading', { name: 'Match Controls' })).toBeVisible();

  const semi = await readMatch(semiA.id);
  expect(semi).toMatchObject({ status: 'COMPLETED', homeScore: 2, awayScore: 0, winnerId: semiA.homeTeamId });
  const liveFinal = await readMatch(final.id);
  expect(liveFinal).toMatchObject({ status: 'LIVE', homeTeamId: semiA.homeTeamId });
});

/**
 * BUG: `EditMatchModal` is the only modal in the workspace without a viewport height cap
 * (`EditTeamModal` has `max-h-[92vh]`, the wizard `max-h-[90vh]`), so its card grows past the
 * window — 1014px tall for a BO1 and 1290px for a BO5 — and the `overflow-y-auto` form inside it
 * can never scroll, because the card is not bounded. On a 1280x720 laptop the header is clipped
 * off the top and "Update Match Data" (bottom at ~802px for BO1, ~940px for BO5) is unreachable:
 * the organizer cannot save a score at all. Every other test in this file works around it by
 * running on a 1400px-tall window.
 */
test('the match editor fits a laptop window: its save button is reachable at 1280x720', async ({ page }) => {
  const { semis } = await fourTeamBracket();
  await loginAs(page, 'marcus');
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`/admin/tournaments/${semis[0].tournamentId}?tab=matches`);
  const modal = await openMatchModal(page, semis[0].id);
  await modal.getByRole('combobox').selectOption('3');

  const button = modal.getByRole('button', { name: 'Update Match Data' });
  const box = (await button.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(720);
});
