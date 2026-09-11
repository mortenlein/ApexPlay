import { expect, test, type APIRequestContext } from '@playwright/test';
import { apiAs, disposeApiContexts, json } from './helpers/api';
import { createSeededTeams, createTournament, readMatch, readMatches } from './helpers/lan-seed';

/**
 * Scoring and advancement on a four-team single-elimination bracket: two semi-finals feeding one
 * final. Round-1 match 0 is wired into the final's HOME slot and match 1 into its AWAY slot
 * (an explicit `nextMatchSlot`, not matchOrder parity), which is what every assertion here leans
 * on — a winner must land in the slot the bracket named.
 *
 * `bestOf` is sent with the score rather than configured on the tournament, because that is how
 * staff actually change a series mid-event, and `scoreLimit` is always derived from it
 * (first to floor(bestOf/2)+1 — so a BO3 is won at 2).
 */
test.describe.configure({ mode: 'serial' });
test.afterEach(disposeApiContexts);

interface Bracket {
  api: APIRequestContext;
  tournamentId: string;
  semiA: Awaited<ReturnType<typeof readMatch>>;
  semiB: Awaited<ReturnType<typeof readMatch>>;
  final: Awaited<ReturnType<typeof readMatch>>;
}

/** A freshly generated four-team bracket, plus an admin context to drive it with. */
async function fourTeamBracket(): Promise<Bracket> {
  const tournament = await createTournament({ teamSize: 1 });
  await createSeededTeams(tournament.id, 4);

  const api = await apiAs('marcus');
  const generated = await api.post(`/api/tournaments/${tournament.id}/generate`, { data: {} });
  expect(generated.status()).toBe(200);

  const matches = await readMatches(tournament.id);
  expect(matches).toHaveLength(3);
  const semis = matches.filter((m) => m.round === 1).sort((a, b) => a.matchOrder - b.matchOrder);
  const final = matches.find((m) => m.round === 2)!;

  // Guard the premise the rest of the file reads from.
  expect(semis[0].nextMatchSlot).toBe('HOME');
  expect(semis[1].nextMatchSlot).toBe('AWAY');
  expect(semis[0].nextMatchId).toBe(final.id);
  expect(semis[1].nextMatchId).toBe(final.id);

  return { api, tournamentId: tournament.id, semiA: semis[0], semiB: semis[1], final };
}

test('a BO3 won 2:0 completes and advances the winner into its named slot', async () => {
  const { api, semiA, semiB, final } = await fourTeamBracket();

  const resA = await api.post(`/api/matches/${semiA.id}`, { data: { bestOf: 3, homeScore: 2, awayScore: 0 } });
  expect(resA.status()).toBe(200);
  expect(await json(resA)).toMatchObject({
    status: 'COMPLETED',
    bestOf: 3,
    scoreLimit: 2,
    winnerId: semiA.homeTeamId,
    resultType: null,
  });

  const resB = await api.post(`/api/matches/${semiB.id}`, { data: { bestOf: 3, homeScore: 0, awayScore: 2 } });
  expect(resB.status()).toBe(200);
  expect((await json(resB)).winnerId).toBe(semiB.awayTeamId);

  // Match 0 owns HOME, match 1 owns AWAY — the final must be filled that way round.
  const playedFinal = await readMatch(final.id);
  expect(playedFinal.homeTeamId).toBe(semiA.homeTeamId);
  expect(playedFinal.awayTeamId).toBe(semiB.awayTeamId);
  expect(playedFinal.status).toBe('PENDING');
});

test('1:0 in a BO3 is a scoreline, not a result', async () => {
  const { api, semiA, final } = await fourTeamBracket();

  const res = await api.post(`/api/matches/${semiA.id}`, { data: { bestOf: 3, homeScore: 1, awayScore: 0 } });
  expect(res.status()).toBe(200);
  const body = await json(res);
  expect(body.status).not.toBe('COMPLETED');
  expect(body.winnerId).toBeNull();
  expect(body).toMatchObject({ homeScore: 1, awayScore: 0, bestOf: 3, scoreLimit: 2 });

  // Nobody has been advanced.
  expect((await readMatch(final.id)).homeTeamId).toBeNull();
});

test('a match marked completed with level scores is refused', async () => {
  const { api, semiA, final } = await fourTeamBracket();

  const res = await api.post(`/api/matches/${semiA.id}`, {
    data: { bestOf: 3, homeScore: 1, awayScore: 1, status: 'COMPLETED' },
  });
  expect(res.status()).toBe(400);
  expect((await json(res)).error).toMatch(/needs a winner/i);

  // The refusal is total: no scores written, no advancement.
  const untouched = await readMatch(semiA.id);
  expect(untouched.homeScore).toBe(0);
  expect(untouched.awayScore).toBe(0);
  expect(untouched.winnerId).toBeNull();
  expect((await readMatch(final.id)).homeTeamId).toBeNull();
});

test('a forfeit by the away team hands the match to home', async () => {
  const { api, semiA, final } = await fourTeamBracket();

  const res = await api.post(`/api/matches/${semiA.id}`, { data: { forfeit: 'AWAY' } });
  expect(res.status()).toBe(200);
  expect(await json(res)).toMatchObject({
    status: 'COMPLETED',
    resultType: 'FORFEIT',
    winnerId: semiA.homeTeamId,
    // Scores default to the win condition for the series when staff don't supply any.
    homeScore: 1,
    awayScore: 0,
  });

  expect((await readMatch(final.id)).homeTeamId).toBe(semiA.homeTeamId);
});

test('reopening a completed match clears its winner and the slot downstream', async () => {
  const { api, semiA, final } = await fourTeamBracket();

  await api.post(`/api/matches/${semiA.id}`, { data: { bestOf: 3, homeScore: 2, awayScore: 0 } });
  expect((await readMatch(final.id)).homeTeamId).toBe(semiA.homeTeamId);

  // Putting a finished match back on the floor must beat the auto-complete rule, or the
  // standing 2:0 would instantly re-complete it and no reopen would ever stick.
  const reopened = await api.post(`/api/matches/${semiA.id}`, { data: { status: 'READY' } });
  expect(reopened.status()).toBe(200);
  expect(await json(reopened)).toMatchObject({ status: 'READY', winnerId: null });

  expect((await readMatch(final.id)).homeTeamId).toBeNull();
});

test('changing a winner after the final has started is refused', async () => {
  const { api, semiA, final } = await fourTeamBracket();

  await api.post(`/api/matches/${semiA.id}`, { data: { bestOf: 3, homeScore: 2, awayScore: 0 } });
  expect((await readMatch(final.id)).homeTeamId).toBe(semiA.homeTeamId);

  // The final goes live with that team in it.
  expect((await api.post(`/api/matches/${final.id}`, { data: { status: 'LIVE' } })).status()).toBe(200);

  const res = await api.post(`/api/matches/${semiA.id}`, { data: { bestOf: 3, homeScore: 0, awayScore: 2 } });
  expect(res.status()).toBe(409);
  expect((await json(res)).error).toBe(
    `Downstream match ${final.id.slice(0, 8)} has already started — reset it first.`
  );

  // Nothing moved: the original result stands and the live final keeps its team.
  const semi = await readMatch(semiA.id);
  expect(semi.winnerId).toBe(semiA.homeTeamId);
  expect(semi.homeScore).toBe(2);
  const liveFinal = await readMatch(final.id);
  expect(liveFinal.status).toBe('LIVE');
  expect(liveFinal.homeTeamId).toBe(semiA.homeTeamId);
});

test('changing a winner while the final is still pending swaps the team over', async () => {
  const { api, semiA, final } = await fourTeamBracket();

  await api.post(`/api/matches/${semiA.id}`, { data: { bestOf: 3, homeScore: 2, awayScore: 0 } });
  expect((await readMatch(final.id)).homeTeamId).toBe(semiA.homeTeamId);

  const corrected = await api.post(`/api/matches/${semiA.id}`, { data: { bestOf: 3, homeScore: 0, awayScore: 2 } });
  expect(corrected.status()).toBe(200);
  expect(await json(corrected)).toMatchObject({ status: 'COMPLETED', winnerId: semiA.awayTeamId });

  // Old team rolled out of the slot, new team rolled in — same slot, no duplicate entry.
  const pendingFinal = await readMatch(final.id);
  expect(pendingFinal.homeTeamId).toBe(semiA.awayTeamId);
  expect(pendingFinal.awayTeamId).toBeNull();
});
