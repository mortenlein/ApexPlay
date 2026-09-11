import { expect, test } from '@playwright/test';
import { apiAnon, apiAs, disposeApiContexts, json } from './helpers/api';
import { createSeededTeams, createTournament, readMatches } from './helpers/lan-seed';

/**
 * Bracket generation for a non-power-of-two field — the normal LAN case, and the one where byes
 * have to be right or half the first round never resolves.
 *
 * Six teams in an eight-slot single-elimination bracket: 4 + 2 + 1 = 7 matches, and the seed-1
 * and seed-2 teams each get a bye because their round-1 opponents (seeds 8 and 7) don't exist.
 */
test.describe.configure({ mode: 'serial' });
test.afterEach(disposeApiContexts);

async function sixTeamTournament() {
  const tournament = await createTournament({ teamSize: 1 });
  const teams = await createSeededTeams(tournament.id, 6);
  return { tournamentId: tournament.id, teams };
}

const bySeed = (teams: { id: string; seed: number | null }[], seed: number) =>
  teams.find((team) => team.seed === seed)!.id;

test('generating a six-team single-elimination bracket resolves the byes', async () => {
  const { tournamentId, teams } = await sixTeamTournament();
  const adminApi = await apiAs('marcus');

  const res = await adminApi.post(`/api/tournaments/${tournamentId}/generate`, { data: {} });
  expect(res.status()).toBe(200);
  expect(await json(res)).toMatchObject({ success: true, count: 7 });

  const matches = await readMatches(tournamentId);
  expect(matches).toHaveLength(7);
  expect(matches.filter((m) => m.round === 1)).toHaveLength(4);
  expect(matches.filter((m) => m.round === 2)).toHaveLength(2);
  expect(matches.filter((m) => m.round === 3)).toHaveLength(1);

  const roundOne = matches.filter((m) => m.round === 1);
  const byes = roundOne.filter((m) => !m.homeTeamId !== !m.awayTeamId);
  const contests = roundOne.filter((m) => m.homeTeamId && m.awayTeamId);
  expect(byes).toHaveLength(2);
  expect(contests).toHaveLength(2);

  // A bye is finished the moment it is created, with the lone team recorded as the winner.
  for (const bye of byes) {
    expect(bye.status).toBe('COMPLETED');
    expect(bye.winnerId).toBe(bye.homeTeamId ?? bye.awayTeamId);
  }

  // Seeds 1 and 2 are the ones who walk through: their opponents (8 and 7) don't exist.
  expect(new Set(byes.map((b) => b.winnerId))).toEqual(new Set([bySeed(teams, 1), bySeed(teams, 2)]));

  // The real first-round pairings are the standard meet-in-the-middle ones: 4v5 and 3v6.
  expect(contests.map((m) => [m.homeTeamId, m.awayTeamId])).toEqual(
    expect.arrayContaining([
      [bySeed(teams, 4), bySeed(teams, 5)],
      [bySeed(teams, 3), bySeed(teams, 6)],
    ])
  );
});

test('a bye winner is placed in the slot its nextMatchSlot names', async () => {
  const { tournamentId, teams } = await sixTeamTournament();
  const adminApi = await apiAs('marcus');
  await adminApi.post(`/api/tournaments/${tournamentId}/generate`, { data: {} });

  const matches = await readMatches(tournamentId);
  const byes = matches.filter((m) => m.round === 1 && m.status === 'COMPLETED');

  for (const bye of byes) {
    expect(bye.nextMatchId).toBeTruthy();
    expect(bye.nextMatchSlot).toBe('HOME');
    const destination = matches.find((m) => m.id === bye.nextMatchId)!;
    // Propagation must follow the recorded slot, not matchOrder parity.
    expect(destination.homeTeamId).toBe(bye.winnerId);
  }

  // Concretely: the top half of round 2 is waiting for seed 1, the bottom half for seed 2.
  const semis = matches.filter((m) => m.round === 2).sort((a, b) => a.matchOrder - b.matchOrder);
  expect(semis[0].homeTeamId).toBe(bySeed(teams, 1));
  expect(semis[0].awayTeamId).toBeNull();
  expect(semis[1].homeTeamId).toBe(bySeed(teams, 2));
  expect(semis[1].awayTeamId).toBeNull();
});

test('only an admin may generate a bracket', async () => {
  const { tournamentId } = await sixTeamTournament();

  const anon = await apiAnon();
  expect((await anon.post(`/api/tournaments/${tournamentId}/generate`, { data: {} })).status()).toBe(401);

  const leoApi = await apiAs('leo');
  expect((await leoApi.post(`/api/tournaments/${tournamentId}/generate`, { data: {} })).status()).toBe(401);

  // A marshal runs matches on the floor but does not reshape the bracket.
  const miaApi = await apiAs('mia');
  expect((await miaApi.post(`/api/tournaments/${tournamentId}/generate`, { data: {} })).status()).toBe(401);

  expect(await readMatches(tournamentId)).toHaveLength(0);
});

test('regenerating needs an explicit override once the bracket is locked', async () => {
  const { tournamentId } = await sixTeamTournament();
  const adminApi = await apiAs('marcus');

  await adminApi.post(`/api/tournaments/${tournamentId}/generate`, { data: {} });
  const firstIds = (await readMatches(tournamentId)).map((m) => m.id);
  expect(firstIds).toHaveLength(7);

  // Generating locked the roster, so a second pass is refused rather than silently wiping a
  // bracket that may already have results on it.
  const blocked = await adminApi.post(`/api/tournaments/${tournamentId}/generate`, { data: {} });
  expect(blocked.status()).toBe(423);
  expect((await json(blocked)).error).toMatch(/locked/i);
  expect((await readMatches(tournamentId)).map((m) => m.id)).toEqual(firstIds);

  const forced = await adminApi.post(`/api/tournaments/${tournamentId}/generate`, { data: { overrideLock: true } });
  expect(forced.status()).toBe(200);
  expect(await json(forced)).toMatchObject({ success: true, count: 7 });

  // The old rows are gone, not appended to.
  const secondIds = (await readMatches(tournamentId)).map((m) => m.id);
  expect(secondIds).toHaveLength(7);
  expect(secondIds.filter((id) => firstIds.includes(id))).toHaveLength(0);
});

test('a bracket needs at least two teams', async () => {
  const tournament = await createTournament({ teamSize: 1 });
  await createSeededTeams(tournament.id, 1);
  const adminApi = await apiAs('marcus');

  const res = await adminApi.post(`/api/tournaments/${tournament.id}/generate`, { data: {} });
  expect(res.status()).toBe(400);
  expect((await json(res)).error).toMatch(/at least 2 teams/i);
});
