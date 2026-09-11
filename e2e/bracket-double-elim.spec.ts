import { expect, test, type APIRequestContext } from '@playwright/test';
import { generateDoubleElimination } from '../src/lib/bracket-utils';
import { apiAs, disposeApiContexts, json } from './helpers/api';
import {
  bySeed,
  complete,
  createSeededTeams,
  createTournament,
  playThrough,
  readMatch,
  readMatches,
  reopen,
  seedAndGenerate,
  slotColumn,
} from './helpers/lan-seed';

/**
 * Double elimination, eight teams, through the real generate + score routes.
 *
 * The losers side is where a bracket engine earns its keep: a WB result has to move *two* teams
 * (winner forward, loser sideways), and a rollback has to undo both. The expected shape is not
 * hand-written here — it is computed by calling `generateDoubleElimination` on the same teams and
 * comparing it to what the API actually stored, so the test pins the *route's* fidelity to the
 * generator rather than re-deriving a bracket by hand.
 */
test.describe.configure({ mode: 'serial' });
test.afterEach(disposeApiContexts);

const FORMAT = {
  teamSize: 1,
  format: 'DOUBLE_ELIMINATION' as const,
  bo3LastRounds: 2,
  bo5LastRounds: 1,
};

async function eightTeamDouble() {
  const api = await apiAs('marcus');
  const bracket = await seedAndGenerate(api, { teams: 8, ...FORMAT });
  return { api, ...bracket };
}

/** What the generator itself lays out for these teams and this format. */
const expectedLayout = (teams: { id: string; seed: number | null }[]) =>
  generateDoubleElimination(
    teams.map((t) => ({ id: t.id, seed: t.seed })),
    { bo3LastRounds: FORMAT.bo3LastRounds, bo5LastRounds: FORMAT.bo5LastRounds }
  );

const key = (m: { bracketType: string; round: number; matchOrder: number }) =>
  `${m.bracketType}#${m.round}#${m.matchOrder}`;

type Coordinates = { bracketType: string; round: number; matchOrder: number };

/** The winners-bracket match at these coordinates. */
const wb = <T extends Coordinates>(matches: T[], round: number, order: number): T =>
  matches.find((m) => m.bracketType === 'WINNERS' && m.round === round && m.matchOrder === order)!;

/** The losers-bracket match at these coordinates (LB rounds run 1..2(k-1)). */
const lb = <T extends Coordinates>(matches: T[], round: number, order: number): T =>
  matches.find((m) => m.bracketType === 'LOSERS' && m.round === round && m.matchOrder === order)!;

test('the stored bracket is exactly what generateDoubleElimination lays out', async () => {
  const { matches, teams } = await eightTeamDouble();
  const expectedMatches = expectedLayout(teams);

  const countBy = (rows: { bracketType: string }[]) =>
    rows.reduce<Record<string, number>>((acc, m) => ({ ...acc, [m.bracketType]: (acc[m.bracketType] ?? 0) + 1 }), {});

  expect(countBy(matches)).toEqual(countBy(expectedMatches));
  expect(matches).toHaveLength(expectedMatches.length);
  // For eight teams that is 7 winners + 6 losers + 1 grand final.
  expect(countBy(matches)).toEqual({ WINNERS: 7, LOSERS: 6, GRAND_FINAL: 1 });

  // Same coordinates, and the same format on each of them.
  expect(new Set(matches.map(key))).toEqual(new Set(expectedMatches.map(key)));
  for (const expected of expectedMatches) {
    const stored = matches.find((m) => key(m) === key(expected))!;
    expect(
      { bestOf: stored.bestOf, scoreLimit: stored.scoreLimit },
      `format of ${key(expected)}`
    ).toEqual({ bestOf: expected.bestOf, scoreLimit: expected.scoreLimit });
    expect(
      { home: stored.homeTeamId, away: stored.awayTeamId },
      `seeding of ${key(expected)}`
    ).toEqual({ home: expected.homeTeamId, away: expected.awayTeamId });
  }

  // The winners side is seeded meet-in-the-middle; nothing else starts with teams in it.
  expect([wb(matches, 1, 0).homeTeamId, wb(matches, 1, 0).awayTeamId]).toEqual([
    bySeed(teams, 1).id,
    bySeed(teams, 8).id,
  ]);
  expect(
    matches.filter((m) => m.bracketType !== 'WINNERS' || m.round !== 1).every((m) => !m.homeTeamId && !m.awayTeamId)
  ).toBe(true);

  // Losers-bracket matches are BO1; the grand final mirrors the winners final (BO5 here).
  expect(matches.filter((m) => m.bracketType === 'LOSERS').map((m) => `${m.bestOf}/${m.scoreLimit}`)).toEqual(
    Array(6).fill('1/1')
  );
  const grandFinal = matches.find((m) => m.bracketType === 'GRAND_FINAL')!;
  expect([grandFinal.bestOf, grandFinal.scoreLimit]).toEqual([5, 3]);
  expect([wb(matches, 3, 0).bestOf, wb(matches, 2, 0).bestOf, wb(matches, 1, 0).bestOf]).toEqual([5, 3, 1]);

  // Routing across brackets: the WB final feeds the grand final's HOME slot, the LB final its
  // AWAY slot, and every WB match names a losers-bracket destination.
  expect(wb(matches, 3, 0).nextMatchId).toBe(grandFinal.id);
  expect(wb(matches, 3, 0).nextMatchSlot).toBe('HOME');
  expect(lb(matches, 4, 0).nextMatchId).toBe(grandFinal.id);
  expect(lb(matches, 4, 0).nextMatchSlot).toBe('AWAY');
  expect(matches.filter((m) => m.bracketType === 'WINNERS').every((m) => Boolean(m.loserNextMatchId))).toBe(true);
  expect(grandFinal.nextMatchId).toBeNull();
  expect(grandFinal.loserNextMatchId).toBeNull();
});

test('a winners-bracket round-one loser drops into the losers match its routing names', async () => {
  const { api, tournamentId, matches, teams } = await eightTeamDouble();

  const roundOne = matches.filter((m) => m.bracketType === 'WINNERS' && m.round === 1);
  expect(roundOne).toHaveLength(4);

  for (const match of roundOne) {
    // Two round-one matches feed each first minor round match, one per column.
    expect(match.loserNextMatchId).toBe(lb(matches, 1, Math.floor(match.matchOrder / 2)).id);
    expect(match.loserNextMatchSlot).toBe(match.matchOrder % 2 === 0 ? 'HOME' : 'AWAY');
    const result = await complete(api, match.id, 'HOME');
    expect(result.winnerId).toBe(match.homeTeamId);
  }

  const after = await readMatches(tournamentId);
  for (const match of roundOne) {
    // Winner forward…
    const nextWb = after.find((m) => m.id === match.nextMatchId)!;
    expect(nextWb[slotColumn(match.nextMatchSlot, match.matchOrder)]).toBe(match.homeTeamId);
    // …loser sideways, into the named column of the named losers match.
    const nextLb = after.find((m) => m.id === match.loserNextMatchId)!;
    expect(nextLb[slotColumn(match.loserNextMatchSlot, match.matchOrder)]).toBe(match.awayTeamId);
  }

  // Concretely: the losers of 1v8 and 4v5 — seeds 8 and 5 — open the losers bracket against
  // each other, both first-round losers matches are now playable, and nothing is double-booked.
  expect([lb(after, 1, 0).homeTeamId, lb(after, 1, 0).awayTeamId]).toEqual([
    bySeed(teams, 8).id,
    bySeed(teams, 5).id,
  ]);
  const lbTeams = after
    .filter((m) => m.bracketType === 'LOSERS')
    .flatMap((m) => [m.homeTeamId, m.awayTeamId])
    .filter(Boolean);
  expect(lbTeams).toHaveLength(4);
  expect(new Set(lbTeams).size).toBe(4);
});

test('the whole double-elimination bracket plays out to a grand-final champion', async () => {
  const { api, tournamentId, teams } = await eightTeamDouble();

  const played = await playThrough(api, tournamentId);
  expect(played).toHaveLength(14);

  const matches = await readMatches(tournamentId);
  for (const m of matches) {
    expect(m.status, `${key(m)} finished`).toBe('COMPLETED');
    expect(m.winnerId, `${key(m)} has a winner`).toBeTruthy();
    expect(m.homeTeamId, `${key(m)} has a home team`).toBeTruthy();
    expect(m.awayTeamId, `${key(m)} has an away team`).toBeTruthy();
  }

  // Every team plays at least twice: that is the point of a losers bracket. (The eventual
  // champion here never loses, so it only needs the four matches of its unbeaten run.)
  for (const team of teams) {
    const appearances = matches.filter((m) => m.homeTeamId === team.id || m.awayTeamId === team.id);
    expect(appearances.length, `seed ${team.seed} plays more than once`).toBeGreaterThanOrEqual(2);
  }

  // HOME wins throughout: seed 1 comes through the winners bracket and takes the BO5 final 3:0
  // against whoever climbed back out of the losers side.
  const grandFinal = matches.find((m) => m.bracketType === 'GRAND_FINAL')!;
  expect(grandFinal.homeTeamId).toBe(bySeed(teams, 1).id);
  expect(grandFinal.winnerId).toBe(bySeed(teams, 1).id);
  expect([grandFinal.bestOf, grandFinal.homeScore, grandFinal.awayScore]).toEqual([5, 3, 0]);
  // Its away side came out of the losers bracket, not the winners one.
  expect(grandFinal.awayTeamId).toBe(lb(matches, 4, 0).winnerId);
  // Losers-bracket matches were all decided 1:0, the BO1 they were generated as.
  for (const m of matches.filter((x) => x.bracketType === 'LOSERS')) {
    expect([m.bestOf, m.homeScore + m.awayScore]).toEqual([1, 1]);
  }
});

test('reopening a winners match pulls the winner out of the winners side and the loser out of the losers side', async () => {
  const { api, tournamentId, matches } = await eightTeamDouble();

  const source = wb(matches, 1, 0);
  const result = await complete(api, source.id, 'HOME');
  expect(result.winnerId).toBe(source.homeTeamId);

  expect((await readMatch(source.nextMatchId!)).homeTeamId).toBe(source.homeTeamId);
  expect((await readMatch(source.loserNextMatchId!)).homeTeamId).toBe(source.awayTeamId);

  const reopened = await reopen(api, source.id);
  expect(reopened.status()).toBe(200);
  expect(await json(reopened)).toMatchObject({ status: 'READY', winnerId: null });

  // Both destinations are emptied — a half-rolled-back result would leave a ghost team in the
  // losers bracket that no result ever put there.
  const after = await readMatches(tournamentId);
  expect(after.find((m) => m.id === source.nextMatchId)!.homeTeamId).toBeNull();
  expect(after.find((m) => m.id === source.loserNextMatchId)!.homeTeamId).toBeNull();
  // The two teams are back where they started and nowhere else in the bracket.
  const stillPlaced = after.filter(
    (m) => m.id !== source.id && [m.homeTeamId, m.awayTeamId].some((id) => id && id === source.homeTeamId)
  );
  expect(stillPlaced).toEqual([]);
});

test('a winners result cannot be reopened once its losers-bracket match is live', async () => {
  const { api, tournamentId, matches } = await eightTeamDouble();

  const source = wb(matches, 1, 0);
  const sibling = wb(matches, 1, 1);
  await complete(api, source.id, 'HOME');
  await complete(api, sibling.id, 'HOME');

  const losersMatch = await readMatch(source.loserNextMatchId!);
  expect([losersMatch.homeTeamId, losersMatch.awayTeamId]).toEqual([source.awayTeamId, sibling.awayTeamId]);

  // The losers-bracket match starts with both dropped teams in it.
  expect((await api.post(`/api/matches/${losersMatch.id}`, { data: { status: 'LIVE' } })).status()).toBe(200);

  const refused = await reopen(api, source.id);
  expect(refused.status()).toBe(409);
  expect((await json(refused)).error).toBe(
    `Downstream match ${losersMatch.id.slice(0, 8)} has already started — reset it first.`
  );

  // Nothing moved: not the winners result, not the winners-side slot, not the live losers match.
  const after = await readMatches(tournamentId);
  const sourceAfter = after.find((m) => m.id === source.id)!;
  expect(sourceAfter.status).toBe('COMPLETED');
  expect(sourceAfter.winnerId).toBe(source.homeTeamId);
  expect(after.find((m) => m.id === source.nextMatchId)!.homeTeamId).toBe(source.homeTeamId);
  const losersAfter = after.find((m) => m.id === losersMatch.id)!;
  expect(losersAfter.status).toBe('LIVE');
  expect([losersAfter.homeTeamId, losersAfter.awayTeamId]).toEqual([source.awayTeamId, sibling.awayTeamId]);
});

test('double elimination refuses a field that is not a power of two', async () => {
  const api = await apiAs('marcus');
  const tournament = await createTournament({ teamSize: 1, format: 'DOUBLE_ELIMINATION' });
  await createSeededTeams(tournament.id, 6);

  const res = await api.post(`/api/tournaments/${tournament.id}/generate`, { data: {} });
  expect(res.status()).toBe(400);
  // The refusal has to say what to do about it, not just "invalid".
  const { error } = await json(res);
  expect(error).toContain('power-of-two team count (4, 8, 16, 32)');
  expect(error).toContain('You have 6');
  expect(error).toContain('Add 2 team(s) or switch to Single Elimination');

  // Refused, not half-built.
  expect(await readMatches(tournament.id)).toHaveLength(0);
});
