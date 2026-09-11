import { expect, test } from '@playwright/test';
import { apiAs, disposeApiContexts, json } from './helpers/api';
import { createCallableMatch, readPlayer } from './helpers/lan-seed';
import { loginAs } from './helpers/auth';

/**
 * The marshal board must be trustworthy across phones: a tap on one marshal's board shows up on
 * every other board without a reload, and a stale "at seat" tick from an earlier call must never
 * survive into the next one.
 */
test.describe.configure({ mode: 'serial' });
test.afterEach(disposeApiContexts);

test('a check-in on one marshal phone appears live on another', async ({ browser }) => {
  const { match, home } = await createCallableMatch();
  const playerId = home.players[0].id;

  const phoneA = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const phoneB = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pageA = await phoneA.newPage();
  const pageB = await phoneB.newPage();
  await loginAs(pageA, 'mia');
  await loginAs(pageB, 'marcus');
  await pageA.goto(`/marshal/dashboard?t=${match.tournamentId}`);
  await pageB.goto(`/marshal/dashboard?t=${match.tournamentId}`);

  const rowA = pageA.getByTestId(`marshal-player-${playerId}`);
  const rowB = pageB.getByTestId(`marshal-player-${playerId}`);
  await expect(rowA).toHaveAttribute('aria-pressed', 'false');
  await expect(rowB).toHaveAttribute('aria-pressed', 'false');
  await expect(pageB.getByTestId('marshal-connection')).toContainText('Live');

  await rowA.click();
  await expect(rowA).toHaveAttribute('aria-pressed', 'true');
  // Arrives over the SSE stream — no reload, no 30s fallback poll needed.
  await expect(rowB).toHaveAttribute('aria-pressed', 'true', { timeout: 10000 });

  await rowB.click();
  await expect(rowB).toHaveAttribute('aria-pressed', 'false');
  await expect(rowA).toHaveAttribute('aria-pressed', 'false', { timeout: 10000 });

  await phoneA.close();
  await phoneB.close();
});

test('calling a match clears earlier check-ins, and so does completing it', async () => {
  const { match, home, away } = await createCallableMatch();
  const miaApi = await apiAs('mia');
  const homeId = home.players[0].id;
  const awayId = away.players[0].id;

  // A tick left over from an earlier match (or a marshal's mistake) on both rosters.
  for (const id of [homeId, awayId]) {
    const res = await miaApi.post(`/api/players/${id}/checkin`, { data: { checkedIn: true } });
    expect(res.status()).toBe(200);
  }
  expect((await readPlayer(homeId))!.checkedInAt).not.toBeNull();

  // Call match → both rosters start from "not found yet".
  const call = await miaApi.post(`/api/matches/${match.id}/load`, { data: {} });
  expect(call.status()).toBe(200);
  const called = await json(call);
  expect(called.match.homeTeam.players[0].checkedInAt).toBeNull();
  expect((await readPlayer(homeId))!.checkedInAt).toBeNull();
  expect((await readPlayer(awayId))!.checkedInAt).toBeNull();

  // Seated during the match, then the match finishes → released again.
  await miaApi.post(`/api/players/${homeId}/checkin`, { data: { checkedIn: true } });
  expect((await readPlayer(homeId))!.checkedInAt).not.toBeNull();
  const done = await miaApi.post(`/api/matches/${match.id}`, {
    data: { homeScore: 1, awayScore: 0, bestOf: 1, status: 'COMPLETED' },
  });
  expect(done.status()).toBe(200);
  expect((await readPlayer(homeId))!.checkedInAt).toBeNull();
});
