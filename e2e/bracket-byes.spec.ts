import { expect, test } from '@playwright/test';
import { standardSeedOrder } from '../src/lib/bracket-utils';
import { apiAs, disposeApiContexts } from './helpers/api';
import {
  bySeed,
  isBye,
  isDoneRow,
  playThrough,
  readMatch,
  readMatches,
  seedAndGenerate,
  slotColumn,
} from './helpers/lan-seed';

/**
 * Odd fields in an eight-slot bracket. `lan-bracket.spec.ts` covers six teams (two byes, both in
 * HOME slots of round 2); these are the two shapes it doesn't reach:
 *
 *  - **five teams** — three byes, and the only pairing that actually gets played in round one.
 *    Two of those byes meet each other, so a round-*two* match is playable the moment the
 *    bracket is generated: the sort of thing that breaks when byes are propagated by parity.
 *  - **seven teams** — a single bye for the top seed, the densest odd field.
 *
 * Both are then played out to a champion, because a bye that is stored correctly but never
 * resolves downstream still stalls a LAN.
 */
test.describe.configure({ mode: 'serial' });
test.afterEach(disposeApiContexts);

/** Which seeds get a walkover in an 8-slot bracket of `teamCount`: those drawn against nobody. */
function expectedByeSeeds(teamCount: number) {
  const order = standardSeedOrder(8);
  const seeds: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [home, away] = [order[i * 2], order[i * 2 + 1]];
    if (home <= teamCount && away > teamCount) seeds.push(home);
    if (away <= teamCount && home > teamCount) seeds.push(away);
  }
  return seeds.sort((a, b) => a - b);
}

for (const teamCount of [5, 7]) {
  const byeSeeds = expectedByeSeeds(teamCount);

  test(`a ${teamCount}-team bracket gives seeds ${byeSeeds.join('/')} a walkover`, async () => {
    const api = await apiAs('marcus');
    const { tournamentId, teams, matches } = await seedAndGenerate(api, { teams: teamCount, teamSize: 1 });

    // An 8-slot bracket either way: 4 + 2 + 1.
    expect(matches).toHaveLength(7);
    expect(matches.filter((m) => m.round === 1)).toHaveLength(4);

    const roundOne = matches.filter((m) => m.round === 1);
    const byes = roundOne.filter(isBye);
    const contests = roundOne.filter((m) => m.homeTeamId && m.awayTeamId);
    expect(byes).toHaveLength(byeSeeds.length);
    expect(contests).toHaveLength(4 - byeSeeds.length);
    // No round-1 match is completely empty — an 8-slot bracket for 5+ teams has no dead pairing.
    expect(byes.length + contests.length).toBe(4);

    // A bye is decided at generation time, in favour of the team that showed up.
    for (const bye of byes) {
      expect(bye.status).toBe('COMPLETED');
      expect(bye.winnerId).toBe(bye.homeTeamId ?? bye.awayTeamId);
      expect([bye.homeScore, bye.awayScore]).toEqual([0, 0]);
    }
    expect(new Set(byes.map((b) => b.winnerId))).toEqual(
      new Set(byeSeeds.map((seed) => bySeed(teams, seed).id))
    );

    // Each walkover is propagated into the column its own `nextMatchSlot` names.
    for (const bye of byes) {
      expect(bye.nextMatchSlot).toBe(bye.matchOrder % 2 === 0 ? 'HOME' : 'AWAY');
      const destination = await readMatch(bye.nextMatchId!);
      expect(destination[slotColumn(bye.nextMatchSlot, bye.matchOrder)]).toBe(bye.winnerId);
      expect(destination.status).toBe('PENDING');
    }

    // Round 2 is only ever half-filled by byes — the rest waits on the played pairings.
    const filledRoundTwoSlots = matches
      .filter((m) => m.round === 2)
      .flatMap((m) => [m.homeTeamId, m.awayTeamId])
      .filter(Boolean);
    expect(filledRoundTwoSlots).toHaveLength(byeSeeds.length);
    expect(await readMatches(tournamentId)).toHaveLength(7);
  });

  test(`a ${teamCount}-team bracket with byes plays through to a champion`, async () => {
    const api = await apiAs('marcus');
    const { tournamentId, teams } = await seedAndGenerate(api, { teams: teamCount, teamSize: 1 });

    const played = await playThrough(api, tournamentId);
    // The byes were already done, so only the real pairings get scored.
    expect(played).toHaveLength(7 - byeSeeds.length);

    const matches = await readMatches(tournamentId);
    for (const m of matches) {
      expect(isDoneRow(m), `match r${m.round}#${m.matchOrder} finished`).toBe(true);
      expect(m.winnerId).toBeTruthy();
      // Every match that was actually contested had two teams; a bye keeps its empty slot.
      if (!isBye(m)) expect([m.homeTeamId, m.awayTeamId].filter(Boolean)).toHaveLength(2);
    }

    // HOME wins throughout, so the bye-carried top seed comes out on top.
    const final = matches.find((m) => m.round === 3)!;
    expect(final.winnerId).toBe(bySeed(teams, 1).id);
  });
}

test('two byes in the same round-two match make it playable straight away', async () => {
  const api = await apiAs('marcus');
  const { tournamentId, teams } = await seedAndGenerate(api, { teams: 5, teamSize: 1 });

  // Seeds 2 and 3 both walk over (their opponents, 7 and 6, don't exist), and both byes point at
  // the bottom round-two match — one into HOME, one into AWAY. It is therefore ready to play
  // before a single game has been scored, which only works if the slots are explicit.
  const matches = await readMatches(tournamentId);
  const bottomSemi = matches.find((m) => m.round === 2 && m.matchOrder === 1)!;
  expect(bottomSemi.homeTeamId).toBe(bySeed(teams, 2).id);
  expect(bottomSemi.awayTeamId).toBe(bySeed(teams, 3).id);

  const feeders = matches.filter((m) => m.nextMatchId === bottomSemi.id);
  expect(feeders).toHaveLength(2);
  expect(feeders.every(isBye)).toBe(true);
  expect(new Set(feeders.map((m) => m.nextMatchSlot))).toEqual(new Set(['HOME', 'AWAY']));
});
