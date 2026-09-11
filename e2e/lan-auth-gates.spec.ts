import { expect, test } from '@playwright/test';
import { ONE_PIXEL_PNG, apiAnon, apiAs, disposeApiContexts, json } from './helpers/api';
import { createCallableMatch, createTeam, createTournament } from './helpers/lan-seed';

/**
 * The gates that stand between a public tournament page and the things only staff may see or do.
 * Every one of these is a contract on a route, so they are all driven through the API.
 *
 * Roles come from steamid allowlists in playwright.config.ts: `marcus` = admin,
 * `mia` = marshal (floor staff), `leo` = plain player.
 */
test.describe.configure({ mode: 'serial' });
test.afterEach(disposeApiContexts);

test('registering a team and uploading a logo both require an identity', async () => {
  const tournament = await createTournament({ teamSize: 1, steamSignupEnabled: true });
  const anon = await apiAnon();

  const teamRes = await anon.post(`/api/tournaments/${tournament.id}/teams`, {
    data: { name: 'Ghost Squad', players: [{ name: 'Ghost' }] },
  });
  expect(teamRes.status()).toBe(401);
  expect((await json(teamRes)).error).toMatch(/sign in required/i);

  // A real file is needed to reach the auth check: /api/upload validates "a file was sent"
  // before it looks at the session, so a bodyless POST answers 400, not 401.
  const uploadRes = await anon.post('/api/upload', {
    multipart: { file: { name: 'logo.png', mimeType: 'image/png', buffer: ONE_PIXEL_PNG } },
  });
  expect(uploadRes.status()).toBe(401);
  expect((await json(uploadRes)).error).toMatch(/sign in required/i);
});

test('the roster CSV export is staff-only', async () => {
  const tournament = await createTournament({ teamSize: 1 });
  await createTeam(tournament.id, {
    name: 'Seed 1',
    seed: 1,
    players: [{ name: 'Player One', steamId: '76561198000000777', seating: 'A01' }],
  });

  const anon = await apiAnon();
  expect((await anon.get(`/api/tournaments/${tournament.id}/teams?format=csv`)).status()).toBe(401);

  const leoApi = await apiAs('leo');
  const playerRes = await leoApi.get(`/api/tournaments/${tournament.id}/teams?format=csv`);
  expect(playerRes.status()).toBe(401);

  // The CSV carries every player's steamId, which is exactly why it is gated.
  const adminApi = await apiAs('marcus');
  const adminRes = await adminApi.get(`/api/tournaments/${tournament.id}/teams?format=csv`);
  expect(adminRes.status()).toBe(200);
  expect(adminRes.headers()['content-type']).toContain('text/csv');
  expect(await adminRes.text()).toContain('76561198000000777');
});

test('the EON bridge token only reaches an admin', async () => {
  const bridgeToken = `eon-${Date.now().toString(36)}`;
  const tournament = await createTournament({ eonBridgeToken: bridgeToken });

  const anon = await apiAnon();
  const publicBody = await json(await anon.get(`/api/tournaments/${tournament.id}`));
  expect(publicBody.id).toBe(tournament.id);
  expect(publicBody).not.toHaveProperty('eonBridgeToken');

  const leoApi = await apiAs('leo');
  expect(await json(await leoApi.get(`/api/tournaments/${tournament.id}`))).not.toHaveProperty('eonBridgeToken');

  // A marshal runs matches but is not an organizer — the webhook bearer stays out of reach.
  const miaApi = await apiAs('mia');
  expect(await json(await miaApi.get(`/api/tournaments/${tournament.id}`))).not.toHaveProperty('eonBridgeToken');

  const adminApi = await apiAs('marcus');
  expect((await json(await adminApi.get(`/api/tournaments/${tournament.id}`))).eonBridgeToken).toBe(bridgeToken);
});

test('scoring a match is staff work: a player is refused, a marshal is not', async () => {
  const { match } = await createCallableMatch();

  const leoApi = await apiAs('leo');
  const playerRes = await leoApi.post(`/api/matches/${match.id}`, { data: { homeScore: 1, awayScore: 0 } });
  expect(playerRes.status()).toBe(401);

  const anon = await apiAnon();
  expect((await anon.post(`/api/matches/${match.id}`, { data: { homeScore: 1, awayScore: 0 } })).status()).toBe(401);

  const miaApi = await apiAs('mia');
  const marshalRes = await miaApi.post(`/api/matches/${match.id}`, { data: { homeScore: 1, awayScore: 0 } });
  expect(marshalRes.status()).toBe(200);
  expect(await json(marshalRes)).toMatchObject({ homeScore: 1, awayScore: 0, status: 'COMPLETED' });
});

test('the public match feed keeps seats but drops player steamIds', async () => {
  const { tournament, match } = await createCallableMatch();
  const anon = await apiAnon();

  const publicMatches = await json<any[]>(await anon.get(`/api/tournaments/${tournament.id}/matches`));
  const publicMatch = publicMatches.find((m) => m.id === match.id)!;
  for (const side of ['homeTeam', 'awayTeam'] as const) {
    expect(publicMatch[side].players.length).toBeGreaterThan(0);
    for (const player of publicMatch[side].players) {
      expect(player).not.toHaveProperty('steamId');
      // Seating and at-seat state are public: the bracket shows who has arrived.
      expect(player).toHaveProperty('seating');
      expect(player).toHaveProperty('checkedInAt');
    }
  }

  // Staff get the full payload, steamIds included, because the marshal board needs them.
  const adminApi = await apiAs('marcus');
  const staffMatches = await json<any[]>(await adminApi.get(`/api/tournaments/${tournament.id}/matches`));
  const staffMatch = staffMatches.find((m) => m.id === match.id)!;
  expect(staffMatch.homeTeam.players[0]).toHaveProperty('steamId');
});
