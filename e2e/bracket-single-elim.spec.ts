import { expect, test } from '@playwright/test';
import { standardSeedOrder } from '../src/lib/bracket-utils';
import { apiAs, disposeApiContexts } from './helpers/api';
import {
  bySeed,
  playThrough,
  readMatches,
  seedAndGenerate,
  seriesLimit,
  slotColumn,
} from './helpers/lan-seed';

/**
 * The full-size single-elimination case, driven entirely through the real API: sixteen teams,
 * fifteen matches, played from the first whistle to a champion.
 *
 * `lan-bracket.spec.ts` already covers the six-team bye shape and the regenerate lock; this file
 * is about the parts only a complete bracket shows — meet-in-the-middle seeding at depth, the
 * per-round best-of escalation (BO1 → BO3 semis → BO5 final), and the invariant that every one
 * of the fourteen advancements lands in the column the bracket named rather than wherever
 * matchOrder parity happens to point.
 */
test.describe.configure({ mode: 'serial' });
test.afterEach(disposeApiContexts);

/** Sixteen teams: BO1 early, BO3 semis (last 2 rounds), BO5 final (last 1). */
async function sixteenTeamBracket() {
  const api = await apiAs('marcus');
  const bracket = await seedAndGenerate(api, {
    teams: 16,
    teamSize: 1,
    bo3LastRounds: 2,
    bo5LastRounds: 1,
  });
  return { api, ...bracket };
}

test('a sixteen-team bracket is fifteen matches, seeded meet-in-the-middle', async () => {
  const { matches, teams } = await sixteenTeamBracket();

  expect(matches).toHaveLength(15);
  expect(matches.filter((m) => m.round === 1)).toHaveLength(8);
  expect(matches.filter((m) => m.round === 2)).toHaveLength(4);
  expect(matches.filter((m) => m.round === 3)).toHaveLength(2);
  expect(matches.filter((m) => m.round === 4)).toHaveLength(1);
  // Single elimination has no losers side and, without hasThirdPlace, no extra column.
  expect(new Set(matches.map((m) => m.bracketType))).toEqual(new Set(['WINNERS']));
  expect(matches.every((m) => m.loserNextMatchId === null)).toBe(true);

  const roundOne = matches.filter((m) => m.round === 1).sort((a, b) => a.matchOrder - b.matchOrder);
  const order = standardSeedOrder(16);

  // The classic bracket: 1v16 at the top, 8v9 under it, and the seed pairs of every match add
  // up to 17 — so the top two seeds cannot meet before the final.
  expect([roundOne[0].homeTeamId, roundOne[0].awayTeamId]).toEqual([
    bySeed(teams, 1).id,
    bySeed(teams, 16).id,
  ]);
  expect([roundOne[1].homeTeamId, roundOne[1].awayTeamId]).toEqual([
    bySeed(teams, 8).id,
    bySeed(teams, 9).id,
  ]);
  // The 2-seed opens in the other half of the draw, against 15.
  expect([roundOne[4].homeTeamId, roundOne[4].awayTeamId]).toEqual([
    bySeed(teams, 2).id,
    bySeed(teams, 15).id,
  ]);

  // …and the whole round, pairing by pairing, against the product's own seed order.
  expect(roundOne.map((m) => [m.homeTeamId, m.awayTeamId])).toEqual(
    Array.from({ length: 8 }, (_, i) => [bySeed(teams, order[i * 2]).id, bySeed(teams, order[i * 2 + 1]).id])
  );
  for (let i = 0; i < 8; i++) {
    expect(order[i * 2] + order[i * 2 + 1]).toBe(17);
  }

  // Nobody sits out: sixteen teams fill sixteen slots, once each.
  const seatedTeamIds = roundOne.flatMap((m) => [m.homeTeamId, m.awayTeamId]);
  expect(new Set(seatedTeamIds).size).toBe(16);
});

test('best-of escalates by round and the score limit is derived from it', async () => {
  const { matches } = await sixteenTeamBracket();

  const formats = (round: number) =>
    matches.filter((m) => m.round === round).map((m) => `${m.bestOf}/${m.scoreLimit}`);

  // bo3LastRounds 2 / bo5LastRounds 1 counted back from the final: BO5 final, BO3 semis, BO1
  // everywhere earlier. scoreLimit is never a second hand-written number.
  expect(formats(1)).toEqual(Array(8).fill('1/1'));
  expect(formats(2)).toEqual(Array(4).fill('1/1'));
  expect(formats(3)).toEqual(Array(2).fill('3/2'));
  expect(formats(4)).toEqual(['5/3']);
  for (const m of matches) {
    expect(m.scoreLimit).toBe(seriesLimit(m.bestOf));
  }
});

test('every slot past round one is fed by exactly one match', async () => {
  const { matches } = await sixteenTeamBracket();

  const byId = new Map(matches.map((m) => [m.id, m]));
  const feeders = new Map<string, number>();

  for (const m of matches) {
    if (m.round === 4) {
      // The final is the end of the line.
      expect(m.nextMatchId).toBeNull();
      continue;
    }
    const destination = byId.get(m.nextMatchId!);
    expect(destination, `match r${m.round}#${m.matchOrder} points at a real match`).toBeTruthy();
    expect(destination!.round).toBe(m.round + 1);
    // The slot is explicit in every generated row — parity is only a legacy fallback.
    expect(m.nextMatchSlot).toBe(m.matchOrder % 2 === 0 ? 'HOME' : 'AWAY');
    const key = `${m.nextMatchId}|${m.nextMatchSlot}`;
    feeders.set(key, (feeders.get(key) ?? 0) + 1);
  }

  // 7 downstream matches × 2 slots = 14 destinations, each claimed by one feeder.
  expect(feeders.size).toBe(14);
  expect([...feeders.values()].filter((count) => count !== 1)).toEqual([]);
});

test('playing all fifteen matches produces the expected champion, with every winner in its named slot', async () => {
  const { api, tournamentId, teams } = await sixteenTeamBracket();

  const played = await playThrough(api, tournamentId);
  expect(played).toHaveLength(15);

  const matches = await readMatches(tournamentId);
  const byId = new Map(matches.map((m) => [m.id, m]));

  // Every advancement went where the bracket said, checked against the pre-state routing
  // columns. Each slot has a single feeder and nothing is reopened here, so the end state
  // still holds exactly who was advanced into it.
  for (const { before, after } of played) {
    expect(after.winnerId).toBe(before.homeTeamId);
    if (!before.nextMatchId) continue;
    const destination = byId.get(before.nextMatchId)!;
    expect(destination[slotColumn(before.nextMatchSlot, before.matchOrder)]).toBe(after.winnerId);
  }

  // Nothing is left half-drawn or unplayed: every match got two teams and a winner.
  for (const m of matches) {
    expect(m.homeTeamId, `match r${m.round}#${m.matchOrder} has a home team`).toBeTruthy();
    expect(m.awayTeamId, `match r${m.round}#${m.matchOrder} has an away team`).toBeTruthy();
    expect(m.status).toBe('COMPLETED');
    expect(m.winnerId).toBeTruthy();
  }

  // HOME wins every match, so each pairing's better seed survives and seed 1 lifts the trophy —
  // and the final is the BO5 it was configured to be, won 3:0.
  const final = matches.find((m) => m.round === 4)!;
  expect(final.winnerId).toBe(bySeed(teams, 1).id);
  expect(final.homeTeamId).toBe(bySeed(teams, 1).id);
  expect(final.awayTeamId).toBe(bySeed(teams, 2).id);
  expect([final.bestOf, final.homeScore, final.awayScore]).toEqual([5, 3, 0]);
});
