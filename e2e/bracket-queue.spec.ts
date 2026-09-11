import { expect, test, type APIRequestContext } from '@playwright/test';
import { standardSeedOrder } from '../src/lib/bracket-utils';
import { apiAs, disposeApiContexts, json } from './helpers/api';
import { personaUserId } from './helpers/auth';
import {
  assignTeamToUser,
  bySeed,
  complete,
  createSeededTeams,
  createTournament,
  isDoneRow,
  playThrough,
  readMatches,
  seedAndGenerate,
} from './helpers/lan-seed';

/**
 * "How long until I play?" — `GET /api/me/queue` read against a real generated bracket.
 *
 * The number is the one thing a player on a beanbag actually looks at, and it is easy to get
 * wrong in the two opposite directions: counting the empty later-round slots of a fresh bracket
 * (so a round-one player looks a dozen matches away), or failing to shrink as matches finish.
 * Every expectation here is computed from the stored bracket with the route's own stated rule —
 * not done, ordered before yours, both teams known (or already called) — so the test pins the
 * rule rather than a magic number, and then also states the concrete number for that bracket.
 */
test.describe.configure({ mode: 'serial' });
test.afterEach(disposeApiContexts);

const SEED_ORDER = standardSeedOrder(16);

/** The seed sitting in a given round-one match of a 16-slot bracket, on a given side. */
const seedAt = (matchOrder: number, side: 'HOME' | 'AWAY') =>
  SEED_ORDER[matchOrder * 2 + (side === 'HOME' ? 0 : 1)];

/** The queue entry for one tournament (leo is registered in several across this file). */
async function queueEntry(api: APIRequestContext, tournamentId: string) {
  const res = await api.get('/api/me/queue');
  expect(res.status()).toBe(200);
  const body = await json<{ queue: any[] }>(res);
  const entry = body.queue.find((q) => q.tournamentId === tournamentId);
  expect(entry, `queue has an entry for ${tournamentId}`).toBeTruthy();
  return entry;
}

/**
 * The route's rule, recomputed straight from the database: not-done matches ordered before
 * `matchId` that either have both teams or are already called/live.
 */
async function matchesAheadOf(tournamentId: string, matchId: string) {
  const pending = (await readMatches(tournamentId))
    .filter((m) => !isDoneRow(m))
    .sort((a, b) => a.round - b.round || a.matchOrder - b.matchOrder);
  const index = pending.findIndex((m) => m.id === matchId);
  expect(index, 'the queued match is still pending').toBeGreaterThanOrEqual(0);
  return pending
    .slice(0, index)
    .filter((m) => (m.homeTeamId && m.awayTeamId) || ['READY', 'WAITING_FOR_PLAYERS', 'LIVE'].includes(m.status))
    .length;
}

/** A 16-team bracket with leo playing for the team on `seed`. */
async function bracketWithLeo(seed: number) {
  const adminApi = await apiAs('marcus');
  const leoApi = await apiAs('leo');
  const { tournamentId, teams } = await seedAndGenerate(adminApi, {
    teams: 16,
    teamSize: 1,
    bo3LastRounds: 2,
    bo5LastRounds: 1,
  });

  const leoTeam = bySeed(teams, seed);
  await assignTeamToUser(leoTeam.id, await personaUserId('leo'));

  const matches = await readMatches(tournamentId);
  const leoMatch = matches.find((m) => m.homeTeamId === leoTeam.id || m.awayTeamId === leoTeam.id)!;
  return { adminApi, leoApi, tournamentId, teams, leoTeam, leoMatch, matches };
}

test("a round-one player's queue names their match, their opponent and their place in line", async () => {
  // Seed 9 is drawn against seed 8 in the second round-one match, so exactly one match is
  // scheduled before theirs.
  expect(seedAt(1, 'AWAY')).toBe(9);
  const { leoApi, tournamentId, teams, leoMatch } = await bracketWithLeo(9);

  const entry = await queueEntry(leoApi, tournamentId);
  expect(entry.state).toBe('SCHEDULED');
  expect(entry.teamName).toBe('Seed 9');
  expect(entry.game).toBe('CS2');
  expect(entry.nextMatch).toMatchObject({
    id: leoMatch.id,
    round: 1,
    status: 'PENDING',
    bracketType: 'WINNERS',
    bestOf: 1,
    opponent: bySeed(teams, 8).name,
    youAreHome: false,
    hasOpponent: true,
  });

  expect(entry.matchesAhead).toBe(await matchesAheadOf(tournamentId, leoMatch.id));
  expect(entry.matchesAhead).toBe(1);
  // The eleven empty later-round slots are not counted as matches to wait through.
  expect(entry.totalPending).toBe(15);
});

test('finishing two matches in front of a player drops their queue by exactly two', async () => {
  // Seed 7 opens in the sixth round-one match: five matches are queued ahead of it.
  expect(seedAt(5, 'HOME')).toBe(7);
  const { adminApi, leoApi, tournamentId, leoMatch, matches } = await bracketWithLeo(7);

  const before = await queueEntry(leoApi, tournamentId);
  expect(before.matchesAhead).toBe(await matchesAheadOf(tournamentId, leoMatch.id));
  expect(before.matchesAhead).toBe(5);

  const earlier = matches
    .filter((m) => m.round === 1 && m.matchOrder < leoMatch.matchOrder)
    .sort((a, b) => a.matchOrder - b.matchOrder);
  await complete(adminApi, earlier[0].id, 'HOME');
  await complete(adminApi, earlier[1].id, 'HOME');

  const after = await queueEntry(leoApi, tournamentId);
  expect(after.matchesAhead).toBe(await matchesAheadOf(tournamentId, leoMatch.id));
  expect(after.matchesAhead).toBe(3);
  // Those two results filled a round-two match, but it is behind this player, not ahead.
  expect(after.nextMatch.id).toBe(leoMatch.id);
  expect(after.totalPending).toBe(13);
});

test("calling a player's match reports the called state, and clearing the one ahead puts them at the front", async () => {
  const { adminApi, leoApi, tournamentId, leoMatch, matches } = await bracketWithLeo(9);

  const called = await adminApi.post(`/api/matches/${leoMatch.id}/load`);
  expect(called.status()).toBe(200);

  const entry = await queueEntry(leoApi, tournamentId);
  expect(entry.state).toBe('SCHEDULED');
  expect(entry.nextMatch.status).toBe('READY');
  // Called, but still one match behind in play order — the call doesn't fake the queue empty.
  expect(entry.matchesAhead).toBe(await matchesAheadOf(tournamentId, leoMatch.id));
  expect(entry.matchesAhead).toBe(1);

  // The match in front finishes: 0 ahead + called = "you're on now".
  const ahead = matches.find((m) => m.round === 1 && m.matchOrder === 0)!;
  await complete(adminApi, ahead.id, 'HOME');

  const now = await queueEntry(leoApi, tournamentId);
  expect(now.matchesAhead).toBe(0);
  expect(now.nextMatch.status).toBe('READY');
  expect(now.nextMatch.id).toBe(leoMatch.id);
});

/**
 * BUG (product, not test): `/api/me/queue` orders play by `(round, matchOrder)` alone
 * (src/app/api/me/queue/route.ts:65) and counts "ahead of you" inside that ordering
 * (route.ts:76-99). Those coordinates are only unique *within* a bracket type: a
 * double-elimination bracket numbers its losers rounds 1..2(k-1) and its grand final round 1,
 * so LOSERS#1#0 and GRAND_FINAL#1#0 sort as if they were the same slot in the schedule — and
 * WINNERS#1#0 too.
 *
 * Measured on an 8-team double-elimination bracket with the winners side fully played: the
 * grand finalist is told `matchesAhead: 1` while six losers-bracket matches remain, two of them
 * playable right now. They will be sitting there for most of an hour being shown "you're up
 * next". The fix belongs in the route (order by bracket stage, not raw round), so the
 * expectation below is written the way it should read.
 */
test.fixme('a grand finalist is not told they are on while the losers bracket is unplayed', async () => {
  const adminApi = await apiAs('marcus');
  const leoApi = await apiAs('leo');
  const { tournamentId, teams } = await seedAndGenerate(adminApi, {
    teams: 8,
    teamSize: 1,
    format: 'DOUBLE_ELIMINATION',
  });
  await assignTeamToUser(bySeed(teams, 1).id, await personaUserId('leo'));

  // Play the winners bracket only: leo's team is in the grand final, waiting for whoever comes
  // out of the losers bracket. Six losers-side matches are still to be played.
  for (const round of [1, 2, 3]) {
    for (const m of (await readMatches(tournamentId)).filter((x) => x.bracketType === 'WINNERS' && x.round === round)) {
      await complete(adminApi, m.id, 'HOME');
    }
  }
  const unplayedLosers = (await readMatches(tournamentId)).filter(
    (m) => m.bracketType === 'LOSERS' && !isDoneRow(m)
  );
  expect(unplayedLosers.length).toBeGreaterThan(0);

  expect(unplayedLosers).toHaveLength(6);
  const playableNow = unplayedLosers.filter((m) => m.homeTeamId && m.awayTeamId);
  expect(playableNow).toHaveLength(2);

  const entry = await queueEntry(leoApi, tournamentId);
  expect(entry.nextMatch.bracketType).toBe('GRAND_FINAL');
  // Every losers-bracket match has to be played before the grand final can start, so the queue
  // must show at least the ones that are playable now — it reports 1.
  expect(entry.matchesAhead).toBeGreaterThanOrEqual(playableNow.length);
});

test('a knocked-out player is out of the queue, and an ungenerated bracket says so', async () => {
  const adminApi = await apiAs('marcus');
  const leoApi = await apiAs('leo');

  // Registered, no bracket yet.
  const pending = await createTournament({ teamSize: 1 });
  const pendingTeams = await createSeededTeams(pending.id, 4);
  await assignTeamToUser(pendingTeams[3].id, await personaUserId('leo'));
  const beforeDraw = await queueEntry(leoApi, pending.id);
  expect(beforeDraw.state).toBe('NO_BRACKET');
  expect(beforeDraw.nextMatch).toBeNull();
  expect(beforeDraw.matchesAhead).toBeNull();

  // Now a bracket that gets played out with leo's team (the 4-seed) losing its opener.
  const { tournamentId, teams } = await seedAndGenerate(adminApi, { teams: 4, teamSize: 1 });
  await assignTeamToUser(bySeed(teams, 4).id, await personaUserId('leo'));
  await playThrough(adminApi, tournamentId);

  const out = await queueEntry(leoApi, tournamentId);
  expect(out.state).toBe('OUT');
  expect(out.nextMatch).toBeNull();
  expect(out.matchesAhead).toBeNull();
  expect(out.totalPending).toBe(0);
});
