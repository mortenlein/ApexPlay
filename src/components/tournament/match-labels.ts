/**
 * The words a spectator sees for a match: its stage and its state.
 *
 * Both used to be spelled out ad hoc in every public component ("R1 | BADE", a raw
 * `SINGLE_ELIMINATION`, `WAITING_FOR_PLAYERS`), so the same match read differently on the
 * bracket, the match board and the live rail. One module, reusing the maps that already exist:
 * `STAGE_LABELS`/`FORMAT_OPTIONS` in `@/lib/games` and the status sets in `@/lib/match-status`.
 */
import { FORMAT_OPTIONS, STAGE_LABELS } from "@/lib/games";
import { isCalled, isDone, isLive } from "@/lib/match-status";

export interface StageMatch {
  id?: string;
  round: number;
  matchOrder?: number;
  bracketType?: string | null;
  nextMatchId?: string | null;
  loserNextMatchId?: string | null;
  homeTeam?: { name?: string | null } | null;
  awayTeam?: { name?: string | null } | null;
}

const typeOf = (match: StageMatch) => (match.bracketType || "WINNERS").toUpperCase();

const maxRound = (matches: StageMatch[], type: string) => {
  const rounds = matches.filter((m) => typeOf(m) === type).map((m) => m.round);
  return rounds.length ? Math.max(...rounds) : 0;
};

/** A bracket with a losers side counts its rounds per side, so stage names differ. */
export function isDoubleElimination(matches: StageMatch[]): boolean {
  return matches.some((m) => typeOf(m) === "LOSERS");
}

/**
 * What this match is called: "Grand Final", "Semi-Finals", "Quarter-Finals", "Round of 16"
 * (`STAGE_LABELS` — the same names the organizer picks best-of stages from), or the
 * winners/losers wording in a double-elimination bracket. `short` is for the bracket canvas,
 * where a node badge has room for "WB Round 1" and not much more.
 */
export function stageName(
  match: StageMatch,
  matches: StageMatch[],
  { short = false }: { short?: boolean } = {}
): string {
  const type = typeOf(match);

  if (type === "THIRD_PLACE") return short ? "3rd Place" : "3rd Place Match";
  if (type === "GRAND_FINAL") return match.matchOrder === 1 ? "Bracket Reset" : "Grand Final";

  if (type === "LOSERS") {
    const lbFinal = maxRound(matches, "LOSERS");
    if (match.round === lbFinal) return "Losers Final";
    return short ? `LB Round ${match.round}` : `Losers Round ${match.round}`;
  }

  const wbRounds = maxRound(matches, "WINNERS");
  if (isDoubleElimination(matches)) {
    if (match.round === wbRounds) return "Winners Final";
    return short ? `WB Round ${match.round}` : `Winners Round ${match.round}`;
  }

  // Single elimination: name the round by how far it is from the final.
  return STAGE_LABELS[wbRounds - match.round + 1] ?? `Round ${match.round}`;
}

const ABBREVIATIONS: Record<string, string> = {
  "Grand Final": "GF",
  "Bracket Reset": "GF2",
  "Semi-Finals": "SF",
  "Quarter-Finals": "QF",
  "Round of 16": "R16",
  "3rd Place Match": "3rd place",
  "Winners Final": "WF",
  "Losers Final": "LF",
};

/** How one match is referred to from somewhere else: "QF2", "WB2". */
export function matchRef(match: StageMatch, matches: StageMatch[]): string {
  const label = stageName(match, matches);
  const base =
    ABBREVIATIONS[label] ??
    label.replace("Winners Round ", "WB").replace("Losers Round ", "LB").replace("Round ", "R");
  const peers = matches
    .filter((m) => stageName(m, matches) === label)
    .sort((a, b) => (a.matchOrder ?? 0) - (b.matchOrder ?? 0));
  if (peers.length < 2) return base;
  const index = peers.findIndex((m) => (m.id ? m.id === match.id : m === match));
  return `${base}${index + 1}`;
}

/**
 * What belongs in a team slot that has no team yet. "TBD" is honest; "Winner of QF2" is more
 * useful, and it is what the bracket actually says — the feeder match points here.
 * (The old code printed "INITIALIZING…", which describes nothing that is happening.)
 */
export function slotLabel(match: StageMatch, side: "HOME" | "AWAY", matches: StageMatch[]): string {
  const team = side === "HOME" ? match.homeTeam : match.awayTeam;
  if (team?.name) return team.name;
  if (!match.id) return "TBD";

  const winnerFeeders = matches.filter((m) => m.nextMatchId === match.id);
  const loserFeeders = matches.filter((m) => m.loserNextMatchId === match.id);

  if (!isDoubleElimination(matches)) {
    // Single elimination fills slots by matchOrder parity (see `generateSingleElimination`), so
    // the feeder for a given side is known exactly.
    const bySide = (m: StageMatch) => ((m.matchOrder ?? 0) % 2 === 0 ? "HOME" : "AWAY") === side;
    const winner = winnerFeeders.find(bySide);
    if (winner) return `Winner of ${matchRef(winner, matches)}`;
    const loser = loserFeeders.find(bySide);
    if (loser) return `Loser of ${matchRef(loser, matches)}`;
    return "TBD";
  }

  // Double elimination routes with explicit slots that the public payload does not carry, so
  // only name the feeder when there is exactly one candidate — a guess would be a lie.
  const emptySlots = (match.homeTeam?.name ? 0 : 1) + (match.awayTeam?.name ? 0 : 1);
  const feeders = [
    ...winnerFeeders.map((m) => ({ m, kind: "Winner" })),
    ...loserFeeders.map((m) => ({ m, kind: "Loser" })),
  ];
  if (emptySlots === 1 && feeders.length === 1) {
    return `${feeders[0].kind} of ${matchRef(feeders[0].m, matches)}`;
  }
  return "TBD";
}

/** Uppercase is fine here: a status is a label, not something a human typed. */
export function matchStatusLabel(status: string | null | undefined): string {
  if (isLive(status)) return "LIVE";
  if (isDone(status)) return "FINAL";
  if (isCalled(status)) return "CALLED";
  return "SCHEDULED";
}

/** Token classes for a status chip — live shouts, everything else stays calm. */
export function matchStatusTone(status: string | null | undefined): string {
  if (isLive(status)) return "border-danger text-danger";
  if (isDone(status)) return "border-line bg-field text-fg-subtle";
  if (isCalled(status)) return "border-success text-success";
  return "border-line bg-field text-fg-muted";
}

/** "SINGLE_ELIMINATION" is a database value, not a sentence. */
export function formatName(format: string | null | undefined): string {
  const key = (format || "").toUpperCase();
  return FORMAT_OPTIONS.find((option) => option.id === key)?.name ?? "";
}

/**
 * Where the bracket actually is, in the terms a spectator asks about: the earliest round that
 * still has matches to play, and how much of it is done ("Quarter-Finals · 2 of 4 played").
 * Returns null when there is no bracket yet or everything has been played.
 */
export function currentStageProgress(
  matches: (StageMatch & { status?: string | null })[]
): { label: string; played: number; total: number } | null {
  if (!matches.length) return null;

  const unplayed = matches.filter((m) => !isDone(m.status));
  if (!unplayed.length) return null;

  const stage = unplayed
    .slice()
    .sort((a, b) => a.round - b.round || (a.matchOrder ?? 0) - (b.matchOrder ?? 0))[0];
  const label = stageName(stage, matches);
  const siblings = matches.filter((m) => stageName(m, matches) === label);

  return {
    label,
    played: siblings.filter((m) => isDone(m.status)).length,
    total: siblings.length,
  };
}
