/**
 * Canonical match status vocabulary. Every list/filter in the app must use these sets instead
 * of hand-rolled string checks so a status added in one place shows up everywhere.
 *
 *   PENDING   – created, not yet called (may still be missing a team)
 *   READY     – called: players should head to their station (was also "WAITING_FOR_PLAYERS")
 *   LIVE      – being played
 *   COMPLETED – has a winner (byes were historically stored as "FINISHED")
 */
export type MatchStatus = 'PENDING' | 'READY' | 'LIVE' | 'COMPLETED';

/** Matches that are over (bye rows written before the vocabulary was unified say FINISHED). */
export const DONE_STATUSES: readonly string[] = ['COMPLETED', 'FINISHED'];
/** Matches whose players have been called to their station but that are not yet live. */
export const CALLED_STATUSES: readonly string[] = ['READY', 'WAITING_FOR_PLAYERS'];
export const LIVE_STATUSES: readonly string[] = ['LIVE'];
/** Called or live — "happening now" from the floor's point of view. */
export const ACTIVE_STATUSES: readonly string[] = [...CALLED_STATUSES, ...LIVE_STATUSES];

export const isDone = (status: string | null | undefined) => DONE_STATUSES.includes(status ?? '');
export const isCalled = (status: string | null | undefined) => CALLED_STATUSES.includes(status ?? '');
export const isLive = (status: string | null | undefined) => LIVE_STATUSES.includes(status ?? '');
export const isActive = (status: string | null | undefined) => ACTIVE_STATUSES.includes(status ?? '');

/** Win condition for a best-of series: first to floor(bestOf / 2) + 1 maps. */
export const scoreLimitFor = (bestOf: number) => Math.floor(Math.max(1, bestOf) / 2) + 1;

/**
 * Where a match sits in the tournament's play order, across bracket types. `round` alone is
 * only unique within a bracket type (a double-elim grand final is stored as round 1, and the
 * losers bracket counts its own rounds), so anything that orders "what plays next" — the player
 * queue, the marshal board, the control cockpit — must go through this.
 *
 *   WINNERS round r  → stage 2r-1   (WB1=1, WB2=3, WB3=5 …)
 *   LOSERS  round L  → stage L+1    (LB1 is played after WB1, LB2/LB3 around WB2 …)
 *   THIRD_PLACE      → after every ordinary round
 *   GRAND_FINAL      → last
 */
export function playStage(match: { bracketType?: string | null; round: number }): number {
  switch ((match.bracketType || 'WINNERS').toUpperCase()) {
    case 'GRAND_FINAL':
      return 1_000_000;
    case 'THIRD_PLACE':
      return 999_999;
    case 'LOSERS':
      return match.round + 1;
    default:
      return 2 * match.round - 1;
  }
}

const BRACKET_RANK: Record<string, number> = { WINNERS: 0, LOSERS: 1, THIRD_PLACE: 2, GRAND_FINAL: 3 };

/** Comparator: earlier stage first, winners before losers within a stage, then matchOrder. */
export function byPlayOrder(
  a: { bracketType?: string | null; round: number; matchOrder: number },
  b: { bracketType?: string | null; round: number; matchOrder: number }
): number {
  return (
    playStage(a) - playStage(b) ||
    (BRACKET_RANK[(a.bracketType || 'WINNERS').toUpperCase()] ?? 0) -
      (BRACKET_RANK[(b.bracketType || 'WINNERS').toUpperCase()] ?? 0) ||
    a.matchOrder - b.matchOrder
  );
}

/**
 * The one human label per match state. Both the shared `StatusBadge` and the public board read
 * this, so a match never reads "Complete" in the admin and "FINAL" on the spectator page for
 * the same row. Casing is a presentation choice — the broadcast surfaces uppercase it in CSS.
 *
 * This is also the seam i18n plugs into: one function to swap for a message lookup, rather than
 * two hand-rolled tables.
 */
export type MatchStatusKey = 'scheduled' | 'called' | 'live' | 'done';

/** The i18n key for a state. UI should translate this; see matchStatusLabel for the rest. */
export function matchStatusKey(status: string | null | undefined): MatchStatusKey {
  if (isLive(status)) return 'live';
  if (isDone(status)) return 'done';
  if (isCalled(status)) return 'called';
  return 'scheduled';
}

const EN_STATUS: Record<MatchStatusKey, string> = {
  scheduled: 'Scheduled',
  called: 'Called',
  live: 'Live',
  done: 'Done',
};

/**
 * English label, for contexts with no translator: server logs, audit summaries, and anywhere a
 * non-React caller needs a word. Rendered UI goes through `matchStatusKey` + `t('status.*')`
 * so a Norwegian player reads "Kalt opp".
 */
export function matchStatusLabel(status: string | null | undefined): string {
  return EN_STATUS[matchStatusKey(status)];
}
