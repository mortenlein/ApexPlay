import { expect, test } from '@playwright/test';
import { apiAs, disposeApiContexts, json } from './helpers/api';
import { complete, readMatch, readMatches, reopen, seedAndGenerate } from './helpers/lan-seed';

/**
 * Two things that only bite a live event: a no-show early in the bracket, and two marshals
 * saving the same match from two phones.
 *
 * A forfeit is a real result — it advances a team, so it has to be rolled back under exactly the
 * same rules as a played one, and it must stop being reversible the moment the next match is on
 * the floor. `lan-scoring.spec.ts` covers a single forfeit on a four-team bracket; here the chain
 * is followed through an eight-team bracket into the round it feeds.
 */
test.describe.configure({ mode: 'serial' });
test.afterEach(disposeApiContexts);

/** Eight teams, single elimination, BO1 throughout. Returns the top round-1 pair and its heir. */
async function eightTeamChain() {
  const api = await apiAs('marcus');
  const { tournamentId, matches } = await seedAndGenerate(api, { teams: 8, teamSize: 1 });

  const roundOne = matches.filter((m) => m.round === 1).sort((a, b) => a.matchOrder - b.matchOrder);
  const quarter = roundOne[0];
  const sibling = roundOne[1];
  const semi = matches.find((m) => m.id === quarter.nextMatchId)!;
  return { api, tournamentId, quarter, sibling, semi };
}

test('a forfeit in round one advances the surviving team like any other result', async () => {
  const { api, quarter, semi } = await eightTeamChain();

  const res = await api.post(`/api/matches/${quarter.id}`, { data: { forfeit: 'AWAY' } });
  expect(res.status()).toBe(200);
  expect(await json(res)).toMatchObject({
    status: 'COMPLETED',
    resultType: 'FORFEIT',
    winnerId: quarter.homeTeamId,
    // No scores supplied, so the series win condition is filled in: BO1 → 1:0.
    homeScore: 1,
    awayScore: 0,
    scoreLimit: 1,
  });

  // It advances into the slot the bracket named, exactly like a played result would.
  expect(quarter.nextMatchSlot).toBe('HOME');
  const heir = await readMatch(semi.id);
  expect(heir.homeTeamId).toBe(quarter.homeTeamId);
  expect(heir.awayTeamId).toBeNull();
  // The no-show is out of the bracket, not sitting in a later round.
  expect(heir.awayTeamId).not.toBe(quarter.awayTeamId);
});

test('a forfeit can still be corrected while the next match has not started', async () => {
  const { api, quarter, semi } = await eightTeamChain();

  await api.post(`/api/matches/${quarter.id}`, { data: { forfeit: 'AWAY' } });
  expect((await readMatch(semi.id)).homeTeamId).toBe(quarter.homeTeamId);

  // The team turned up after all: put the match back on the floor…
  const reopened = await reopen(api, quarter.id);
  expect(reopened.status()).toBe(200);
  expect(await json(reopened)).toMatchObject({ status: 'READY', winnerId: null, resultType: null });
  expect((await readMatch(semi.id)).homeTeamId).toBeNull();

  // …and play it out the other way. The correct team ends up in the semi, alone in that slot.
  const played = await complete(api, quarter.id, 'AWAY');
  expect(played).toMatchObject({ status: 'COMPLETED', winnerId: quarter.awayTeamId, resultType: null });
  const heir = await readMatch(semi.id);
  expect(heir.homeTeamId).toBe(quarter.awayTeamId);
  expect(heir.awayTeamId).toBeNull();
});

test('a forfeit is locked in once the match it fed has started', async () => {
  const { api, tournamentId, quarter, sibling, semi } = await eightTeamChain();

  await api.post(`/api/matches/${quarter.id}`, { data: { forfeit: 'AWAY' } });
  await complete(api, sibling.id, 'HOME');

  // The semi now has both teams and is called to a station.
  const staged = await readMatch(semi.id);
  expect([staged.homeTeamId, staged.awayTeamId]).toEqual([quarter.homeTeamId, sibling.homeTeamId]);
  expect((await api.post(`/api/matches/${semi.id}`, { data: { status: 'LIVE' } })).status()).toBe(200);

  const refused = await reopen(api, quarter.id);
  expect(refused.status()).toBe(409);
  expect((await json(refused)).error).toBe(
    `Downstream match ${semi.id.slice(0, 8)} has already started — reset it first.`
  );

  // Scoring it differently is refused for the same reason — a forfeit is not a special case.
  const rescored = await api.post(`/api/matches/${quarter.id}`, { data: { homeScore: 0, awayScore: 1 } });
  expect(rescored.status()).toBe(409);

  // The forfeit still stands, and the live semi kept its team.
  const after = await readMatches(tournamentId);
  const quarterAfter = after.find((m) => m.id === quarter.id)!;
  expect(quarterAfter).toMatchObject({
    status: 'COMPLETED',
    resultType: 'FORFEIT',
    winnerId: quarter.homeTeamId,
    homeScore: 1,
    awayScore: 0,
  });
  const semiAfter = after.find((m) => m.id === semi.id)!;
  expect(semiAfter.status).toBe('LIVE');
  expect(semiAfter.homeTeamId).toBe(quarter.homeTeamId);
});

test('two marshals saving the same match: the stale save is refused', async () => {
  const api = await apiAs('marcus');
  const { tournamentId, matches } = await seedAndGenerate(api, { teams: 4, teamSize: 1 });
  const semi = matches.find((m) => m.round === 1 && m.matchOrder === 0)!;

  // Both phones loaded the match at the same moment, so both hold this timestamp.
  const loadedAt = semi.updatedAt.toISOString();

  const first = await api.post(`/api/matches/${semi.id}`, {
    data: { bestOf: 3, homeScore: 1, awayScore: 0, expectedUpdatedAt: loadedAt },
  });
  expect(first.status()).toBe(200);
  expect(await json(first)).toMatchObject({ homeScore: 1, awayScore: 0, bestOf: 3 });

  // The row moved on; the second phone's copy is now stale.
  const afterFirst = await readMatch(semi.id);
  expect(afterFirst.updatedAt.toISOString()).not.toBe(loadedAt);

  const second = await api.post(`/api/matches/${semi.id}`, {
    data: { bestOf: 3, homeScore: 0, awayScore: 1, expectedUpdatedAt: loadedAt },
  });
  expect(second.status()).toBe(409);
  expect((await json(second)).error).toBe('This record changed in another session. Refresh and try again.');

  // The refusal wrote nothing: the first save's scoreline stands.
  const settled = await readMatch(semi.id);
  expect([settled.homeScore, settled.awayScore]).toEqual([1, 0]);
  expect(settled.winnerId).toBeNull();

  // Re-reading and saving against the fresh timestamp goes through.
  const retried = await api.post(`/api/matches/${semi.id}`, {
    data: { bestOf: 3, homeScore: 0, awayScore: 2, expectedUpdatedAt: settled.updatedAt.toISOString() },
  });
  expect(retried.status()).toBe(200);
  expect(await json(retried)).toMatchObject({ status: 'COMPLETED', winnerId: semi.awayTeamId });
  expect((await readMatches(tournamentId)).find((m) => m.round === 2)!.homeTeamId).toBe(semi.awayTeamId);
});
