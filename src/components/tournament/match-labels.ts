/**
 * The words a spectator sees for a match: its stage and its state.
 *
 * Both used to be spelled out ad hoc in every public component ("R1 | BADE", a raw
 * `SINGLE_ELIMINATION`, `WAITING_FOR_PLAYERS`), so the same match read differently on the
 * bracket, the match board and the live rail. One module, one vocabulary.
 *
 * i18n: every function here is pure and takes the translator it should speak through, so the
 * bracket canvas (a plain layout function, not a component) and the React tree share one set of
 * words. Callers pass `useTranslations('tournament')`; `slotLabel` also takes the `common`
 * translator because "TBD" is a shared word, not a bracket word.
 *
 * The stage decision itself lives in `stageDescriptor` and is language-free: it yields message
 * keys, which is why `matchRef` can abbreviate "Kvartfinale" to "KF" without doing string
 * surgery on a translated label (the old code did `label.replace("Round ", "R")`).
 */
import { isCalled, isDone, isLive } from "@/lib/match-status";

/** A namespace-bound `t`, as returned by `useTranslations(ns)` / `getTranslations(ns)`. */
export type Translator = (key: string, values?: Record<string, string | number>) => string;

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
 * Which stage a match belongs to, as message keys rather than words: `long` for a heading,
 * `short` for a bracket node badge ("WB Round 1" and not much more), `abbr` for a cross
 * reference ("QF2"). `values` carries the round number where the name needs one.
 */
interface StageDescriptor {
  long: string;
  short: string;
  abbr: string;
  values?: { n: number };
}

/** How far this round is from the final, in the same order as the organizer's stage picker. */
const SINGLE_ELIM_STAGES: Record<number, string> = {
  1: "grandFinal",
  2: "semiFinals",
  3: "quarterFinals",
  4: "roundOf16",
};

function stageDescriptor(match: StageMatch, matches: StageMatch[]): StageDescriptor {
  const type = typeOf(match);

  if (type === "THIRD_PLACE") {
    return { long: "thirdPlace", short: "thirdPlaceShort", abbr: "thirdPlace" };
  }
  if (type === "GRAND_FINAL") {
    const key = match.matchOrder === 1 ? "bracketReset" : "grandFinal";
    return { long: key, short: key, abbr: key };
  }

  if (type === "LOSERS") {
    if (match.round === maxRound(matches, "LOSERS")) {
      return { long: "losersFinal", short: "losersFinal", abbr: "losersFinal" };
    }
    return {
      long: "losersRound",
      short: "losersRoundShort",
      abbr: "losersRound",
      values: { n: match.round },
    };
  }

  const wbRounds = maxRound(matches, "WINNERS");
  if (isDoubleElimination(matches)) {
    if (match.round === wbRounds) {
      return { long: "winnersFinal", short: "winnersFinal", abbr: "winnersFinal" };
    }
    return {
      long: "winnersRound",
      short: "winnersRoundShort",
      abbr: "winnersRound",
      values: { n: match.round },
    };
  }

  // Single elimination: name the round by how far it is from the final.
  const key = SINGLE_ELIM_STAGES[wbRounds - match.round + 1];
  if (key) return { long: key, short: key, abbr: key };
  return { long: "round", short: "round", abbr: "round", values: { n: match.round } };
}

/**
 * What this match is called: "Grand Final", "Semi-Finals", "Quarter-Finals", "Round of 16", or
 * the winners/losers wording in a double-elimination bracket. `short` is for the bracket canvas.
 */
export function stageName(
  match: StageMatch,
  matches: StageMatch[],
  t: Translator,
  { short = false }: { short?: boolean } = {}
): string {
  const stage = stageDescriptor(match, matches);
  return t(`bracketStage.${short ? stage.short : stage.long}`, stage.values);
}

/** How one match is referred to from somewhere else: "QF2", "WB2". */
export function matchRef(match: StageMatch, matches: StageMatch[], t: Translator): string {
  const stage = stageDescriptor(match, matches);
  const base = t(`abbr.${stage.abbr}`, stage.values);
  const peers = matches
    .filter((m) => {
      const other = stageDescriptor(m, matches);
      return other.long === stage.long && other.values?.n === stage.values?.n;
    })
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
export function slotLabel(
  match: StageMatch,
  side: "HOME" | "AWAY",
  matches: StageMatch[],
  t: Translator,
  tCommon: Translator
): string {
  const team = side === "HOME" ? match.homeTeam : match.awayTeam;
  if (team?.name) return team.name;
  const tbd = tCommon("tbd");
  if (!match.id) return tbd;

  const winnerFeeders = matches.filter((m) => m.nextMatchId === match.id);
  const loserFeeders = matches.filter((m) => m.loserNextMatchId === match.id);

  if (!isDoubleElimination(matches)) {
    // Single elimination fills slots by matchOrder parity (see `generateSingleElimination`), so
    // the feeder for a given side is known exactly.
    const bySide = (m: StageMatch) => ((m.matchOrder ?? 0) % 2 === 0 ? "HOME" : "AWAY") === side;
    const winner = winnerFeeders.find(bySide);
    if (winner) return t("slot.winnerOf", { ref: matchRef(winner, matches, t) });
    const loser = loserFeeders.find(bySide);
    if (loser) return t("slot.loserOf", { ref: matchRef(loser, matches, t) });
    return tbd;
  }

  // Double elimination routes with explicit slots that the public payload does not carry, so
  // only name the feeder when there is exactly one candidate — a guess would be a lie.
  const emptySlots = (match.homeTeam?.name ? 0 : 1) + (match.awayTeam?.name ? 0 : 1);
  const feeders = [
    ...winnerFeeders.map((m) => ({ m, key: "slot.winnerOf" })),
    ...loserFeeders.map((m) => ({ m, key: "slot.loserOf" })),
  ];
  if (emptySlots === 1 && feeders.length === 1) {
    return t(feeders[0].key, { ref: matchRef(feeders[0].m, matches, t) });
  }
  return tbd;
}

/** Token classes for a status chip — live shouts, everything else stays calm. */
export function matchStatusTone(status: string | null | undefined): string {
  if (isLive(status)) return "border-danger text-danger";
  if (isDone(status)) return "border-line bg-field text-fg-subtle";
  if (isCalled(status)) return "border-success text-success";
  return "border-line bg-field text-fg-muted";
}

/** "SINGLE_ELIMINATION" is a database value, not a sentence. */
const FORMAT_KEYS: Record<string, string> = {
  SINGLE_ELIMINATION: "format.singleElimination",
  DOUBLE_ELIMINATION: "format.doubleElimination",
};

export function formatName(format: string | null | undefined, t: Translator): string {
  const key = FORMAT_KEYS[(format || "").toUpperCase()];
  return key ? t(key) : "";
}

/**
 * Where the bracket actually is, in the terms a spectator asks about: the earliest round that
 * still has matches to play, and how much of it is done ("Quarter-Finals · 2 of 4 played").
 * Returns null when there is no bracket yet or everything has been played.
 */
export function currentStageProgress(
  matches: (StageMatch & { status?: string | null })[],
  t: Translator
): { label: string; played: number; total: number } | null {
  if (!matches.length) return null;

  const unplayed = matches.filter((m) => !isDone(m.status));
  if (!unplayed.length) return null;

  const stage = unplayed
    .slice()
    .sort((a, b) => a.round - b.round || (a.matchOrder ?? 0) - (b.matchOrder ?? 0))[0];
  const descriptor = stageDescriptor(stage, matches);
  const siblings = matches.filter((m) => {
    const other = stageDescriptor(m, matches);
    return other.long === descriptor.long && other.values?.n === descriptor.values?.n;
  });

  return {
    label: stageName(stage, matches, t),
    played: siblings.filter((m) => isDone(m.status)).length,
    total: siblings.length,
  };
}
