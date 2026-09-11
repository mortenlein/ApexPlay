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
