import { expect, test } from '@playwright/test';
import { apiAnon, apiAs, disposeApiContexts, json } from './helpers/api';
import { createTeam, createTournament } from './helpers/lan-seed';
import { PERSONAS, mintSessionToken, personaUserId } from './helpers/auth';

/**
 * GET /api/user/profile — the payload behind both the player desk and /profile.
 *
 * It is the one player-facing endpoint that joins a user to their teams, so it is also the
 * easiest place to leak a roster-mate's Steam id. House rule 2 (CLAUDE.md): a non-staff
 * response never carries someone else's `steamId`.
 */
test.describe.configure({ mode: 'serial' });
test.afterEach(disposeApiContexts);

/** Leo and Sam on the same team, plus a rival team neither of them is on. */
async function sharedTeamTournament(name: string) {
  await mintSessionToken('leo');
  await mintSessionToken('sam');
  const leoUserId = await personaUserId('leo');
  const samUserId = await personaUserId('sam');

  const tournament = await createTournament({ name, teamSize: 2, steamSignupEnabled: true });
  const team = await createTeam(tournament.id, {
    name: 'Leo Legion',
    seed: 1,
    players: [
      { name: 'Leo', seating: 'B12', steamId: PERSONAS.leo.steamId, userId: leoUserId, isLeader: true },
      { name: 'Sam', seating: 'B13', steamId: PERSONAS.sam.steamId, userId: samUserId },
    ],
  });
  await createTeam(tournament.id, {
    name: 'Rival Squad',
    seed: 2,
    players: [{ name: 'Stranger', seating: 'Z99', steamId: '76561198000000999' }],
  });

  return { tournamentId: tournament.id, teamId: team.id, leoUserId, samUserId };
}

test('the profile payload carries the caller’s own registrations, with their seat', async () => {
  const { tournamentId, teamId, leoUserId } = await sharedTeamTournament('Profile Own Cup');
  const leo = await apiAs('leo');

  const body = await json(await leo.get('/api/user/profile'));

  // One registration per tournament the caller is in — and Sam's registration is not one.
  const mine = body.registrations.filter((r: any) => r.team.tournament.id === tournamentId);
  expect(mine).toHaveLength(1);
  expect(body.registrations.every((r: any) => r.userId === leoUserId)).toBe(true);
  expect(mine[0]).toMatchObject({
    name: 'Leo',
    seating: 'B12',
    isLeader: true,
    teamId,
    team: { name: 'Leo Legion', tournament: { id: tournamentId, name: 'Profile Own Cup' } },
  });
  expect(body.user).toMatchObject({ id: leoUserId, name: 'Leo' });
  expect(body.stats.tournamentsJoined).toBe(body.registrations.length);
  expect(body.stats.seatAssignments).toBeGreaterThanOrEqual(1);
});

test('no other player’s Steam id is anywhere in the profile payload', async () => {
  await sharedTeamTournament('Profile Leak Cup');
  const leo = await apiAs('leo');

  const res = await leo.get('/api/user/profile');
  const raw = await res.text();
  const body = JSON.parse(raw);

  // Raw-text search, because the identifier could be nested anywhere in the team/match joins.
  expect(raw).not.toContain(PERSONAS.sam.steamId);
  expect(raw).not.toContain('76561198000000999');
  // The caller's own Steam id is fine — /profile shows it back to them.
  expect(body.user.steamId).toBe(PERSONAS.leo.steamId);

  // Roster-mates appear as name + seat only, so the team panel can be drawn.
  const teammates = body.registrations.flatMap((r: any) => r.team.players ?? []);
  expect(teammates.length).toBeGreaterThan(0);
  for (const player of teammates) {
    expect(Object.keys(player).sort()).toEqual(['id', 'name', 'seating']);
  }
});

test('the ?view=profile payload is the lean one: registrations and seats, no match join', async () => {
  const { tournamentId } = await sharedTeamTournament('Profile View Cup');
  const leo = await apiAs('leo');

  const body = await json(await leo.get('/api/user/profile?view=profile'));

  const mine = body.registrations.find((r: any) => r.team.tournament.id === tournamentId);
  expect(mine).toMatchObject({ seating: 'B12', team: { name: 'Leo Legion' } });
  // /profile renders neither the roster nor the next-match hero, so neither is fetched.
  expect(mine.team).not.toHaveProperty('players');
  expect(body.activeMatches).toEqual([]);
  // The counts are still real — the page's "Open Matches" tile reads them.
  expect(body.stats).toHaveProperty('activeMatches');
});

test('the player’s own endpoints are all closed to anonymous callers', async () => {
  const anon = await apiAnon();

  // Each of these answers with the caller's identity, so there is no anonymous version of it.
  for (const url of ['/api/user/profile', '/api/user/profile?view=profile', '/api/me/queue']) {
    const res = await anon.get(url);
    expect(res.status(), url).toBe(401);
    expect((await json(res)).error).toBe('Unauthorized');
  }
  expect((await anon.patch('/api/me/player', { data: { tournamentId: 'x', seating: 'A1' } })).status()).toBe(401);
  expect((await anon.delete('/api/me/player?tournamentId=x')).status()).toBe(401);
});
