/**
 * Standalone correctness tests for the bracket generators (no DB, no framework).
 * Run: npx ts-node --transpile-only --compiler-options '{"module":"CommonJS"}' scripts/test-bracket-utils.ts
 */
import {
  generateSingleElimination,
  generateDoubleElimination,
  bestOfForRound,
  BracketMatch,
} from "../src/lib/bracket-utils";
import {
  decideMatchResult,
  downstreamBlocksReset,
  StoredMatchState,
} from "../src/lib/match-result";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function makeTeams(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `t${i + 1}`, seed: i + 1 }));
}

const keyOf = (bt: string, r: number | null, o: number | null) => `${bt}#${r}#${o}`;

/**
 * Verify every winner/loser link points at a real match and that each destination slot is fed
 * by exactly one source — except the winners-bracket round-1 slots, which are seeded.
 */
function verifyLinking(label: string, matches: BracketMatch[], seededSlots: number) {
  const byKey = new Map<string, BracketMatch>();
  for (const m of matches) byKey.set(keyOf(m.bracketType, m.round, m.matchOrder), m);

  // (destinationKey, slot) -> feeder count
  const slotFeeders = new Map<string, number>();
  const bump = (k: string) => slotFeeders.set(k, (slotFeeders.get(k) || 0) + 1);

  let danglingTargets = 0;
  let selfLinks = 0;

  // Mirror the advancement code: explicit slot when set, else matchOrder parity.
  const slotFor = (m: BracketMatch, explicit?: string) =>
    explicit ?? (m.matchOrder % 2 === 0 ? "HOME" : "AWAY");

  for (const m of matches) {
    const src = keyOf(m.bracketType, m.round, m.matchOrder);
    if (m.nextMatchRound != null) {
      const bt = m.nextMatchBracketType ?? "WINNERS";
      const dest = keyOf(bt, m.nextMatchRound, m.nextMatchOrder);
      if (!byKey.has(dest)) danglingTargets++;
      if (dest === src) selfLinks++;
      bump(`${dest}|${slotFor(m, m.nextMatchSlot)}`);
    }
    if (m.loserNextMatchRound != null) {
      const bt = m.loserNextMatchBracketType ?? "LOSERS";
      const dest = keyOf(bt, m.loserNextMatchRound, m.loserNextMatchOrder);
      if (!byKey.has(dest)) danglingTargets++;
      if (dest === src) selfLinks++;
      bump(`${dest}|${slotFor(m, m.loserNextMatchSlot)}`);
    }
  }

  check(`${label}: no dangling link targets`, danglingTargets === 0, `${danglingTargets} dangling`);
  check(`${label}: no self-links`, selfLinks === 0, `${selfLinks} self-links`);

  // Every non-seeded slot fed exactly once; no slot fed twice.
  const totalSlots = matches.length * 2;
  const fedSlots = Array.from(slotFeeders.values());
  const doubleFed = fedSlots.filter((c) => c > 1).length;
  const totalFeeders = fedSlots.reduce((a, b) => a + b, 0);
  check(`${label}: no slot fed more than once`, doubleFed === 0, `${doubleFed} double-fed`);
  check(
    `${label}: fed slots + seeded slots == all slots`,
    slotFeeders.size + seededSlots === totalSlots,
    `fed ${slotFeeders.size} + seeded ${seededSlots} != ${totalSlots}`
  );
  check(`${label}: every feeder lands in a distinct slot`, totalFeeders === slotFeeders.size);
}

console.log("Single elimination (8 teams):");
{
  const m = generateSingleElimination(makeTeams(8));
  const winners = m.filter((x) => x.bracketType === "WINNERS");
  check("7 matches", winners.length === 7, `got ${winners.length}`);
  const r1 = winners.filter((x) => x.round === 1);
  check("4 round-1 matches", r1.length === 4);
  check("all round-1 slots seeded", r1.every((x) => x.homeTeamId && x.awayTeamId));
  verifyLinking("SE8", m, 8);
}

for (const n of [4, 8, 16, 32]) {
  console.log(`\nDouble elimination (${n} teams):`);
  const m = generateDoubleElimination(makeTeams(n));
  const wb = m.filter((x) => x.bracketType === "WINNERS");
  const lb = m.filter((x) => x.bracketType === "LOSERS");
  const gf = m.filter((x) => x.bracketType === "GRAND_FINAL");

  check(`winners bracket has ${n - 1} matches`, wb.length === n - 1, `got ${wb.length}`);
  check(`losers bracket has ${n - 2} matches`, lb.length === n - 2, `got ${lb.length}`);
  check("exactly one grand final", gf.length === 1);
  check(`total = ${2 * n - 2} matches`, m.length === 2 * n - 2, `got ${m.length}`);

  const r1 = wb.filter((x) => x.round === 1);
  check("all WB round-1 slots seeded", r1.every((x) => x.homeTeamId && x.awayTeamId));

  // Grand final must be fed by exactly the WB final (HOME) and the LB final (AWAY).
  const gfKey = keyOf("GRAND_FINAL", 1, 0);
  const feedsGf = m.filter(
    (x) => x.nextMatchBracketType === "GRAND_FINAL"
  );
  check("grand final fed by exactly 2 matches", feedsGf.length === 2, `got ${feedsGf.length}`);
  check(
    "grand final fed HOME + AWAY",
    feedsGf.some((x) => x.nextMatchSlot === "HOME") && feedsGf.some((x) => x.nextMatchSlot === "AWAY")
  );

  verifyLinking(`DE${n}`, m, n);
}

console.log("\nBest-of (stage-relative, last-N-rounds):");
{
  // 8 teams = 3 rounds (R1 quarters, R2 semis, R3 final).
  const bo = (r: number, totalRounds: number, opts: any) => bestOfForRound(r, totalRounds, opts).bestOf;

  check("default (no settings) = BO1 every round", [1, 2, 3].every((r) => bo(r, 3, {}) === 1));

  // BO3 from Semi-Finals (last 2 rounds) in an 8-team bracket.
  check("BO3 last-2: R1 quarters stays BO1", bo(1, 3, { bo3LastRounds: 2 }) === 1);
  check("BO3 last-2: R2 semis = BO3", bo(2, 3, { bo3LastRounds: 2 }) === 3);
  check("BO3 last-2: R3 final = BO3", bo(3, 3, { bo3LastRounds: 2 }) === 3);

  // BO5 Grand Final overrides BO3 at the final.
  check("BO5 last-1 + BO3 last-2: final = BO5", bo(3, 3, { bo3LastRounds: 2, bo5LastRounds: 1 }) === 5);
  check("BO5 last-1 + BO3 last-2: semis = BO3", bo(2, 3, { bo3LastRounds: 2, bo5LastRounds: 1 }) === 3);

  // Works for a small (4-team = 2 round) bracket — the bug we fixed.
  check("4-team, Grand Final BO3: R1 BO1", bo(1, 2, { bo3LastRounds: 1 }) === 1);
  check("4-team, Grand Final BO3: final BO3", bo(2, 2, { bo3LastRounds: 1 }) === 3);

  // Stage deeper than the bracket -> applies to all its rounds (no silent no-op).
  check("stage deeper than bracket applies to all rounds", [1, 2, 3].every((r) => bo(r, 3, { bo3LastRounds: 4 }) === 3));

  // Through the generator.
  const se = generateSingleElimination(makeTeams(8), { bo3LastRounds: 2, bo5LastRounds: 1 });
  const byRound = (r: number) => se.find((m) => m.bracketType === "WINNERS" && m.round === r);
  check("SE8 generated: R1 bestOf 1", byRound(1)?.bestOf === 1);
  check("SE8 generated: R2 bestOf 3", byRound(2)?.bestOf === 3);
  check("SE8 generated: R3 (final) bestOf 5", byRound(3)?.bestOf === 5);

  const de = generateDoubleElimination(makeTeams(8), { bo5LastRounds: 1 });
  check("DE8: grand final bestOf 5", de.find((m) => m.bracketType === "GRAND_FINAL")?.bestOf === 5);
  check("DE8: losers bracket stays BO1", de.filter((m) => m.bracketType === "LOSERS").every((m) => m.bestOf === 1));
}

console.log("\nValidation:");
{
  let threw = false;
  try {
    generateDoubleElimination(makeTeams(6));
  } catch {
    threw = true;
  }
  check("non-power-of-two team count is rejected", threw);
}

console.log("\nMatch result decisions:");
{
  // A winners-bracket match: winner goes to W#1, loser drops to L#1. Even matchOrder -> HOME.
  const base = (over: Partial<StoredMatchState> = {}): StoredMatchState => ({
    homeTeamId: "home",
    awayTeamId: "away",
    homeScore: 0,
    awayScore: 0,
    bestOf: 1,
    status: "READY",
    winnerId: null,
    matchOrder: 0,
    nextMatchId: "next",
    nextMatchSlot: null,
    loserNextMatchId: "losers",
    loserNextMatchSlot: "AWAY",
    ...over,
  });
  const plan = (m: StoredMatchState, input: any) => {
    const d = decideMatchResult(m, input);
    if (!d.ok) throw new Error(`expected a plan, got ${d.status} ${d.error}`);
    return d.plan;
  };

  // scoreLimit follows bestOf — the BO1 -> BO3 switch that used to auto-complete after one map.
  check("BO1 derives scoreLimit 1", plan(base(), { bestOf: 1 }).scoreLimit === 1);
  check("BO3 derives scoreLimit 2", plan(base(), { bestOf: 3 }).scoreLimit === 2);
  check("BO5 derives scoreLimit 3", plan(base(), { bestOf: 5 }).scoreLimit === 3);
  check(
    "BO1 -> BO3 with 1:0 no longer auto-completes",
    plan(base({ bestOf: 1 }), { bestOf: 3, homeScore: 1, awayScore: 0 }).status === "READY"
  );
  check(
    "client-sent scoreLimit is ignored",
    plan(base(), { bestOf: 3, scoreLimit: 1 }).scoreLimit === 2
  );
  check(
    "stored bestOf is used when the body omits it",
    plan(base({ bestOf: 5 }), { homeScore: 2, awayScore: 0 }).scoreLimit === 3
  );

  // Reaching the limit still auto-completes and advances.
  {
    const p = plan(base({ bestOf: 3 }), { homeScore: 2, awayScore: 1 });
    check("reaching the BO3 limit completes", p.status === "COMPLETED" && p.winnerId === "home");
    check("winner advances to next (HOME by parity)", p.advance.some((a) => a.matchId === "next" && a.slot === "HOME" && a.teamId === "home"));
    check("loser advances to losers bracket (explicit AWAY slot)", p.advance.some((a) => a.matchId === "losers" && a.slot === "AWAY" && a.teamId === "away"));
    check("nothing to un-advance on a first completion", p.unadvance.length === 0);
  }

  // Refuse a completed match with no winner.
  {
    const tie = decideMatchResult(base(), { status: "COMPLETED", homeScore: 1, awayScore: 1 });
    check("completed with a tie is refused", tie.ok === false && tie.status === 400 && tie.error === "A completed match needs a winner");
    const zero = decideMatchResult(base(), { status: "COMPLETED" });
    check("completed 0:0 is refused", zero.ok === false);
  }

  // Forfeit: the other team wins by the series limit and advances.
  {
    const p = plan(base({ bestOf: 3 }), { forfeit: "HOME" });
    check("home forfeit picks away as winner", p.winnerId === "away" && p.loserId === "home");
    check("forfeit completes the match", p.status === "COMPLETED" && p.resultType === "FORFEIT");
    check("forfeit scores are 0:scoreLimit in the winner's favour", p.homeScore === 0 && p.awayScore === 2);
    check("forfeit advances the winner", p.advance.some((a) => a.matchId === "next" && a.teamId === "away"));
    const withScores = plan(base(), { forfeit: "AWAY", homeScore: 1, awayScore: 0 });
    check("forfeit keeps scores the body carried", withScores.homeScore === 1 && withScores.awayScore === 0 && withScores.winnerId === "home");
    const missingTeam = decideMatchResult(base({ awayTeamId: null }), { forfeit: "HOME" });
    check("forfeit needs both teams", missingTeam.ok === false && missingTeam.status === 400);
    const cleared = plan(base({ status: "COMPLETED", winnerId: "away", homeScore: 0, awayScore: 2, bestOf: 3 }), { status: "COMPLETED", homeScore: 0, awayScore: 2, bestOf: 3 });
    check("a later non-forfeit save clears resultType", cleared.resultType === null);
  }

  // Reopening a completed match clears the winner and rolls the advance back.
  {
    const completed = base({ status: "COMPLETED", winnerId: "home", homeScore: 1, awayScore: 0 });
    const p = plan(completed, { status: "LIVE" });
    check("reopening clears the winner", p.winnerId === null && p.loserId === null);
    check("reopening keeps the requested status", p.status === "LIVE");
    check("reopening un-advances the old winner", p.unadvance.some((u) => u.matchId === "next" && u.slot === "HOME" && u.teamId === "home"));
    check("reopening un-advances the old loser", p.unadvance.some((u) => u.matchId === "losers" && u.slot === "AWAY" && u.teamId === "away"));
    check("reopening advances nobody", p.advance.length === 0);
  }

  // Changing the winner un-advances the old pair and advances the new one.
  {
    const completed = base({ status: "COMPLETED", winnerId: "home", homeScore: 1, awayScore: 0 });
    const p = plan(completed, { status: "COMPLETED", homeScore: 0, awayScore: 1 });
    check("changed winner is the away team", p.winnerId === "away" && p.loserId === "home");
    check("changed winner un-advances the old winner", p.unadvance.some((u) => u.matchId === "next" && u.teamId === "home"));
    check("changed winner un-advances the old loser", p.unadvance.some((u) => u.matchId === "losers" && u.teamId === "away"));
    check("changed winner advances the new winner", p.advance.some((a) => a.matchId === "next" && a.teamId === "away"));
    check("changed winner advances the new loser", p.advance.some((a) => a.matchId === "losers" && a.teamId === "home"));
  }

  // Re-saving the same result must not churn the downstream slots.
  {
    const completed = base({ status: "COMPLETED", winnerId: "home", homeScore: 1, awayScore: 0 });
    const p = plan(completed, { status: "COMPLETED", homeScore: 1, awayScore: 0 });
    check("re-saving the same winner un-advances nothing", p.unadvance.length === 0);
    check("re-saving the same winner is still idempotent-advance", p.advance.length === 2);
  }

  // Odd matchOrder falls back to the AWAY slot; a legacy FINISHED bye counts as completed.
  {
    const p = plan(base({ matchOrder: 1, loserNextMatchId: null }), { homeScore: 1 });
    check("odd matchOrder advances into AWAY", p.advance.some((a) => a.matchId === "next" && a.slot === "AWAY"));
    const legacy = plan(base({ status: "FINISHED", winnerId: "home", homeScore: 1 }), { status: "PENDING", homeScore: 0 });
    check("legacy FINISHED bye is treated as completed", legacy.unadvance.some((u) => u.teamId === "home"));
  }

  // The downstream guard.
  check("untouched downstream match can be reset", downstreamBlocksReset({ id: "n", status: "PENDING", homeScore: 0, awayScore: 0 }) === false);
  check("live downstream match blocks the reset", downstreamBlocksReset({ id: "n", status: "LIVE", homeScore: 0, awayScore: 0 }));
  check("completed downstream match blocks the reset", downstreamBlocksReset({ id: "n", status: "COMPLETED", homeScore: 1, awayScore: 0 }));
  check("scored downstream match blocks the reset", downstreamBlocksReset({ id: "n", status: "READY", homeScore: 1, awayScore: 0 }));
}

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
