import { expect, test, type APIRequestContext } from '@playwright/test';
import { apiAs, disposeApiContexts, json } from './helpers/api';
import { complete, readMatch, readMatches, reopen, seedAndGenerate } from './helpers/lan-seed';

/**
 * The optional bronze match: eight teams, single elimination, `hasThirdPlace` on.
 *
 * Two semi-finals feed it — which is the interesting part, because two losers aiming at the same
 * match is the one place in a single-elimination bracket where a missing HOME/AWAY slot would
 * have the second loser silently overwrite the first. The generator states the columns
 * explicitly (semi 0 → HOME, semi 1 → AWAY); these tests hold that contract through the real
 * route, in both directions: filling the match, and rolling a semi back out of it.
 */
test.describe.configure({ mode: 'serial' });
test.afterEach(disposeApiContexts);

interface ThirdPlaceBracket {
  api: APIRequestContext;
  tournamentId: string;
  semis: Awaited<ReturnType<typeof readMatches>>;
  final: Awaited<ReturnType<typeof readMatch>>;
  third: Awaited<ReturnType<typeof readMatch>>;
}

/** Eight teams, bronze match on, BO3 final (so the bronze match's format can be compared to it). */
async function eightTeamWithBronze(): Promise<ThirdPlaceBracket> {
  const api = await apiAs('marcus');
  const { tournamentId, matches } = await seedAndGenerate(api, {
    teams: 8,
    teamSize: 1,
    hasThirdPlace: true,
    bo3LastRounds: 1,
  });

  const semis = matches.filter((m) => m.round === 2 && m.bracketType === 'WINNERS').sort((a, b) => a.matchOrder - b.matchOrder);
  const final = matches.find((m) => m.round === 3 && m.bracketType === 'WINNERS')!;
  const third = matches.find((m) => m.bracketType === 'THIRD_PLACE')!;
  return { api, tournamentId, semis, final, third };
}

test('a bronze match is an eighth row wired to both semi-final losers', async () => {
  const { tournamentId, semis, final, third } = await eightTeamWithBronze();
  const matches = await readMatches(tournamentId);

  // 4 + 2 + 1 + the bronze match.
  expect(matches).toHaveLength(8);
  expect(matches.filter((m) => m.bracketType === 'THIRD_PLACE')).toHaveLength(1);

  // It sits in the final's column (round 3) at matchOrder 1, and leads nowhere.
  expect([third.round, third.matchOrder]).toEqual([3, 1]);
  expect(third.nextMatchId).toBeNull();
  expect(third.loserNextMatchId).toBeNull();
  // It inherits the final's format rather than the semis' BO1.
  expect(third.bestOf).toBe(final.bestOf);
  expect(third.bestOf).toBe(3);

  // Both semis drop their loser into it, in *distinct* named columns.
  expect(semis.map((m) => m.loserNextMatchId)).toEqual([third.id, third.id]);
  expect(semis.map((m) => m.loserNextMatchSlot)).toEqual(['HOME', 'AWAY']);
  // …while their winners still go to the final, likewise in distinct columns.
  expect(semis.map((m) => m.nextMatchId)).toEqual([final.id, final.id]);
  expect(semis.map((m) => m.nextMatchSlot)).toEqual(['HOME', 'AWAY']);
});

test('both semi losers land in the bronze match without displacing each other', async () => {
  const { api, tournamentId, semis, final, third } = await eightTeamWithBronze();

  // Fill the semis from round 1, then decide them opposite ways round, so the two losers are not
  // both on the same side of their match.
  const quarters = (await readMatches(tournamentId)).filter((m) => m.round === 1);
  expect(quarters).toHaveLength(4);
  for (const q of quarters) await complete(api, q.id, 'HOME');

  const semiA = await readMatch(semis[0].id);
  const semiB = await readMatch(semis[1].id);
  const resultA = await complete(api, semiA.id, 'HOME');
  const resultB = await complete(api, semiB.id, 'AWAY');

  const bronze = await readMatch(third.id);
  expect(bronze.homeTeamId).toBe(semiA.awayTeamId); // semi 0's loser → HOME
  expect(bronze.awayTeamId).toBe(semiB.homeTeamId); // semi 1's loser → AWAY
  expect(bronze.homeTeamId).not.toBe(bronze.awayTeamId);
  expect(bronze.status).toBe('PENDING');

  // The final got the winners, and the two matches share no team.
  const playedFinal = await readMatch(final.id);
  expect(playedFinal.homeTeamId).toBe(resultA.winnerId);
  expect(playedFinal.awayTeamId).toBe(resultB.winnerId);
  expect([bronze.homeTeamId, bronze.awayTeamId]).not.toContain(playedFinal.homeTeamId);
  expect([bronze.homeTeamId, bronze.awayTeamId]).not.toContain(playedFinal.awayTeamId);
});

test('completing the bronze match leaves the final alone', async () => {
  const { api, tournamentId, semis, final, third } = await eightTeamWithBronze();

  for (const q of (await readMatches(tournamentId)).filter((m) => m.round === 1)) {
    await complete(api, q.id, 'HOME');
  }
  await complete(api, semis[0].id, 'HOME');
  await complete(api, semis[1].id, 'HOME');

  const finalBefore = await readMatch(final.id);
  const bronzeResult = await complete(api, third.id, 'HOME');
  expect(bronzeResult.status).toBe('COMPLETED');
  expect(bronzeResult.winnerId).toBe((await readMatch(third.id)).homeTeamId);

  // Third place is a dead end: no winner is pushed anywhere, and the final is untouched.
  const finalAfter = await readMatch(final.id);
  expect(finalAfter.homeTeamId).toBe(finalBefore.homeTeamId);
  expect(finalAfter.awayTeamId).toBe(finalBefore.awayTeamId);
  expect(finalAfter.status).toBe('PENDING');
  expect(finalAfter.winnerId).toBeNull();
  expect([finalAfter.homeScore, finalAfter.awayScore]).toEqual([0, 0]);
});

test('reopening a semi-final clears its slot in the final and in the bronze match', async () => {
  const { api, tournamentId, semis, final, third } = await eightTeamWithBronze();

  for (const q of (await readMatches(tournamentId)).filter((m) => m.round === 1)) {
    await complete(api, q.id, 'HOME');
  }
  const semiA = await readMatch(semis[0].id);
  await complete(api, semiA.id, 'HOME');
  await complete(api, semis[1].id, 'HOME');

  expect((await readMatch(final.id)).homeTeamId).toBe(semiA.homeTeamId);
  expect((await readMatch(third.id)).homeTeamId).toBe(semiA.awayTeamId);

  const reopened = await reopen(api, semiA.id);
  expect(reopened.status()).toBe(200);
  expect(await json(reopened)).toMatchObject({ status: 'READY', winnerId: null });

  // A rollback has to undo *both* destinations — the winner's and the loser's.
  const finalAfter = await readMatch(final.id);
  expect(finalAfter.homeTeamId).toBeNull();
  expect(finalAfter.awayTeamId).toBeTruthy(); // the other semi's winner stays put
  const bronzeAfter = await readMatch(third.id);
  expect(bronzeAfter.homeTeamId).toBeNull();
  expect(bronzeAfter.awayTeamId).toBeTruthy(); // …and so does the other semi's loser
});

test('a semi cannot be reopened once the bronze match has started', async () => {
  const { api, tournamentId, semis, third } = await eightTeamWithBronze();

  for (const q of (await readMatches(tournamentId)).filter((m) => m.round === 1)) {
    await complete(api, q.id, 'HOME');
  }
  const semiA = await readMatch(semis[0].id);
  await complete(api, semiA.id, 'HOME');
  await complete(api, semis[1].id, 'HOME');

  // The bronze match goes live with semi 0's loser in it.
  expect((await api.post(`/api/matches/${third.id}`, { data: { status: 'LIVE' } })).status()).toBe(200);

  const refused = await reopen(api, semiA.id);
  expect(refused.status()).toBe(409);
  expect((await json(refused)).error).toBe(
    `Downstream match ${third.id.slice(0, 8)} has already started — reset it first.`
  );

  // Refusal is total: the semi keeps its result and the live bronze match keeps its team.
  const semiAfter = await readMatch(semiA.id);
  expect(semiAfter.status).toBe('COMPLETED');
  expect(semiAfter.winnerId).toBe(semiA.homeTeamId);
  const bronzeAfter = await readMatch(third.id);
  expect(bronzeAfter.status).toBe('LIVE');
  expect(bronzeAfter.homeTeamId).toBe(semiA.awayTeamId);
});
