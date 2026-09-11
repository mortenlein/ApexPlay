import { expect, test } from '@playwright/test';
import { apiAnon, apiAs, disposeApiContexts, json } from './helpers/api';
import {
  createBridgedMatch,
  createCallableMatch,
  createSeededTeams,
  createTournament,
  readMatch,
  readMatches,
  readNotifications,
} from './helpers/lan-seed';

/**
 * The announcement side channel. `NEXT_PUBLIC_STRATEGY_3_MOCK=true` (playwright.config.ts) keeps
 * Discord in mock mode, but `src/lib/discord.ts` writes the `NotificationLog` row on *both* the
 * mock and the real delivery path — that row is what the marshal board and the admin timeline
 * read, so it is the observable contract here.
 *
 * Titles come from the announce methods: `announceSignup` → "Player registered",
 * `announceMatch` → "Match ready for players", `announceResult` → "Result posted", and the
 * generator's one-shot `announceTournamentUpdate` → "Bracket is live" (logged as a MATCH row).
 */
test.describe.configure({ mode: 'serial' });
test.afterEach(disposeApiContexts);

/** The feed as (type, title) pairs — the shape the assertions below talk about. */
async function feed(tournamentId: string) {
  return (await readNotifications(tournamentId)).map((row) => [row.type, row.title] as const);
}

test('a Steam signup announces the player', async () => {
  const tournament = await createTournament({ teamSize: 1, steamSignupEnabled: true });
  const leo = await apiAs('leo');

  const res = await leo.post(`/api/tournaments/${tournament.id}/signup`, {
    data: { action: 'CREATE_TEAM', teamName: 'Leo Crew', seating: 'B12' },
  });
  expect(res.status()).toBe(200);

  const rows = await readNotifications(tournament.id);
  expect(rows.map((row) => [row.type, row.title])).toEqual([['SIGNUP', 'Player registered']]);
  expect(rows[0].description).toContain(tournament.name);
});

test('generating the bracket announces once, not once per match', async () => {
  const tournament = await createTournament({ teamSize: 1 });
  await createSeededTeams(tournament.id, 4);
  const marcus = await apiAs('marcus');

  expect((await marcus.post(`/api/tournaments/${tournament.id}/generate`, { data: {} })).status()).toBe(200);
  expect(await readMatches(tournament.id)).toHaveLength(3);

  const rows = await readNotifications(tournament.id);
  expect(rows.map((row) => [row.type, row.title])).toEqual([['MATCH', 'Bracket is live']]);
  expect(rows[0].description).toContain('3 matches generated for 4 teams');
});

test('calling a match announces it, and calling it again straight away does not', async () => {
  const { tournament, match } = await createCallableMatch();
  const mia = await apiAs('mia');

  expect((await mia.post(`/api/matches/${match.id}/load`)).status()).toBe(200);
  expect(await feed(tournament.id)).toEqual([['MATCH', 'Match ready for players']]);

  // Double-click on "Start match": inside the 10s dedupe window, so the marshal feed keeps one row.
  expect((await mia.post(`/api/matches/${match.id}/load`)).status()).toBe(200);
  expect(await feed(tournament.id)).toEqual([['MATCH', 'Match ready for players']]);
});

test('posting a result announces it exactly once', async () => {
  const { tournament, match } = await createCallableMatch();
  const mia = await apiAs('mia');

  expect((await mia.post(`/api/matches/${match.id}/load`)).status()).toBe(200);
  const scored = await mia.post(`/api/matches/${match.id}`, { data: { homeScore: 1, awayScore: 0 } });
  expect(scored.status()).toBe(200);
  expect((await json(scored)).status).toBe('COMPLETED');

  // Re-posting the same score does not re-announce: the match was already done.
  expect((await mia.post(`/api/matches/${match.id}`, { data: { homeScore: 1, awayScore: 0 } })).status()).toBe(200);

  const rows = await readNotifications(tournament.id);
  expect(rows.map((row) => [row.type, row.title])).toEqual([
    ['MATCH', 'Match ready for players'],
    ['RESULT', 'Result posted'],
  ]);
  expect(rows[1].description).toContain('Official result');
  expect((await readMatch(match.id)).winnerId).toBeTruthy();
});

test('the manual announce endpoint is admin-only and logs in mock mode', async () => {
  const { tournament, match } = await createBridgedMatch();
  const marcus = await apiAs('marcus');
  const mia = await apiAs('mia');
  const leo = await apiAs('leo');
  const anon = await apiAnon();

  const body = { matchId: match.id, tournamentId: tournament.id, type: 'START' };
  for (const [who, api] of [
    ['mia', mia],
    ['leo', leo],
    ['anon', anon],
  ] as const) {
    const res = await api.post('/api/discord/announce', { data: body });
    expect(res.status(), who).toBe(401);
  }
  expect(await feed(tournament.id)).toEqual([]);

  expect((await marcus.post('/api/discord/announce', { data: body })).status()).toBe(200);
  expect((await marcus.post('/api/discord/announce', { data: { ...body, type: 'RESULT' } })).status()).toBe(200);
  expect(await feed(tournament.id)).toEqual([
    ['MATCH', 'Match ready for players'],
    ['RESULT', 'Result posted'],
  ]);

  // A malformed call is rejected before anything is announced.
  const bad = await marcus.post('/api/discord/announce', { data: { tournamentId: tournament.id } });
  expect(bad.status()).toBe(400);
  const unknownType = await marcus.post('/api/discord/announce', { data: { ...body, type: 'NONSENSE' } });
  expect(unknownType.status()).toBe(400);
});

test('the notification feed is staff-only and scoped to one tournament', async () => {
  const mine = await createCallableMatch();
  const other = await createCallableMatch();
  const marcus = await apiAs('marcus');
  const mia = await apiAs('mia');
  const leo = await apiAs('leo');
  const anon = await apiAnon();

  expect((await marcus.post(`/api/matches/${mine.match.id}/load`)).status()).toBe(200);
  expect((await marcus.post(`/api/matches/${other.match.id}`, { data: { homeScore: 1, awayScore: 0 } })).status()).toBe(200);

  // A marshal reads the board; a player and an anonymous caller cannot.
  const staffView = await mia.get(`/api/notifications/log?tournamentId=${mine.tournament.id}`);
  expect(staffView.status()).toBe(200);
  const payload = await json(staffView);
  expect(payload.count).toBe(1);
  expect(payload.notifications).toHaveLength(1);
  expect(payload.notifications[0]).toMatchObject({
    type: 'MATCH',
    embed: { title: 'Match ready for players' },
  });

  // The other tournament's RESULT row is not in this tournament's feed…
  const otherView = await json(await mia.get(`/api/notifications/log?tournamentId=${other.tournament.id}`));
  expect(otherView.notifications.map((n: any) => n.type)).toEqual(['RESULT']);
  // …though both show up unfiltered.
  const all = await json(await mia.get('/api/notifications/log'));
  expect(all.count).toBeGreaterThanOrEqual(2);

  expect((await leo.get(`/api/notifications/log?tournamentId=${mine.tournament.id}`)).status()).toBe(401);
  expect((await anon.get(`/api/notifications/log?tournamentId=${mine.tournament.id}`)).status()).toBe(401);
});
