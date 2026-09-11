/**
 * Pure decision logic for a match score/status save.
 *
 * Everything that decides *what* should happen — the win condition for the series, who won,
 * whether a downstream slot has to be cleared before the new winner is advanced — lives here
 * so it can be unit-tested without a database. The route is left with the I/O: read the match,
 * refuse or apply the plan, advance, broadcast.
 */
// Relative import (not "@/lib/...") so scripts/test-bracket-utils.ts can run this module under
// bare ts-node, without the Next path aliases.
import { isDone, isLive, scoreLimitFor } from "./match-status";

export type MatchSlot = "HOME" | "AWAY";
export type MatchSide = "HOME" | "AWAY";

/** The stored match, as far as the decision cares about it. */
export interface StoredMatchState {
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore: number;
  awayScore: number;
  bestOf: number | null;
  status: string | null;
  winnerId: string | null;
  matchOrder: number;
  nextMatchId: string | null;
  nextMatchSlot: string | null;
  loserNextMatchId: string | null;
  loserNextMatchSlot: string | null;
}

/** The client-supplied half of the save. `scoreLimit` is deliberately absent: it is derived. */
export interface MatchUpdateRequest {
  homeScore?: number;
  awayScore?: number;
  bestOf?: number;
  status?: string;
  forfeit?: MatchSide | null;
}

/** "Put `teamId` in this slot of this match." */
export interface AdvanceStep {
  matchId: string;
  slot: MatchSlot;
  teamId: string;
}

/** "Empty this slot of this match, but only if it still holds `teamId`." */
export interface UnadvanceStep {
  matchId: string;
  slot: MatchSlot;
  teamId: string;
}

export interface MatchResultPlan {
  homeScore: number;
  awayScore: number;
  bestOf: number;
  /** Always derived from `bestOf`; a client-sent scoreLimit is ignored. */
  scoreLimit: number;
  status: string;
  winnerId: string | null;
  loserId: string | null;
  resultType: "FORFEIT" | null;
  /** Slots to clear before the new result is applied (old winner/loser rolled back). */
  unadvance: UnadvanceStep[];
  /** Slots to fill once the result is applied. */
  advance: AdvanceStep[];
}

export type MatchResultDecision =
  | { ok: true; plan: MatchResultPlan }
  | { ok: false; status: number; error: string };

/**
 * Which slot of a downstream match a feeder lands in: the explicit slot recorded by the
 * generator when present, else the historical matchOrder parity rule.
 */
export function resolveSlot(explicit: string | null | undefined, matchOrder: number): MatchSlot {
  if (explicit === "HOME" || explicit === "AWAY") return explicit;
  return matchOrder % 2 === 0 ? "HOME" : "AWAY";
}

/** The downstream match as far as the "can I still roll this back?" guard cares. */
export interface DownstreamMatchState {
  id: string;
  status: string | null;
  homeScore: number;
  awayScore: number;
}

/**
 * A downstream match that is already live/over, or that has scores on it, must not have a team
 * yanked out from under it — staff have to reset it first.
 */
export function downstreamBlocksReset(match: DownstreamMatchState): boolean {
  return isDone(match.status) || isLive(match.status) || match.homeScore !== 0 || match.awayScore !== 0;
}

export function downstreamBlockedMessage(matchId: string): string {
  return `Downstream match ${matchId.slice(0, 8)} has already started — reset it first.`;
}

/** The team that lost a completed match, given its winner. */
function otherTeam(match: StoredMatchState, teamId: string | null): string | null {
  if (!teamId) return null;
  if (teamId === match.homeTeamId) return match.awayTeamId;
  if (teamId === match.awayTeamId) return match.homeTeamId;
  return null;
}

export function decideMatchResult(match: StoredMatchState, input: MatchUpdateRequest): MatchResultDecision {
  const bestOf = input.bestOf !== undefined ? input.bestOf : match.bestOf || 1;
  if (!Number.isFinite(bestOf) || bestOf < 1) {
    return { ok: false, status: 400, error: "bestOf must be at least 1" };
  }
  const scoreLimit = scoreLimitFor(bestOf);

  const forfeit = input.forfeit ?? null;
  if (forfeit && forfeit !== "HOME" && forfeit !== "AWAY") {
    return { ok: false, status: 400, error: "forfeit must be HOME or AWAY" };
  }

  let homeScore = input.homeScore !== undefined ? input.homeScore : match.homeScore;
  let awayScore = input.awayScore !== undefined ? input.awayScore : match.awayScore;
  let status = input.status || match.status || "READY";
  let winnerId: string | null = null;
  let loserId: string | null = null;
  let resultType: "FORFEIT" | null = null;

  if (forfeit) {
    if (!match.homeTeamId || !match.awayTeamId) {
      return { ok: false, status: 400, error: "Both teams must be assigned to record a forfeit" };
    }
    const scoresSupplied = input.homeScore !== undefined || input.awayScore !== undefined;
    winnerId = forfeit === "HOME" ? match.awayTeamId : match.homeTeamId;
    loserId = forfeit === "HOME" ? match.homeTeamId : match.awayTeamId;
    status = "COMPLETED";
    resultType = "FORFEIT";
    if (!scoresSupplied) {
      homeScore = forfeit === "HOME" ? 0 : scoreLimit;
      awayScore = forfeit === "HOME" ? scoreLimit : 0;
    }
  } else if (!isDone(status)) {
    // Asking for a finished match to go back on the floor wins over the auto-complete rule:
    // the standing scores would otherwise re-complete it instantly and no reopen would ever
    // stick. Score entry that doesn't name a status still auto-completes.
    const reopening = isDone(match.status) && Boolean(input.status);

    // Auto-complete when a side reaches the series win condition.
    if (!reopening && homeScore >= scoreLimit) {
      winnerId = match.homeTeamId;
      loserId = match.awayTeamId;
      status = "COMPLETED";
    } else if (!reopening && awayScore >= scoreLimit) {
      winnerId = match.awayTeamId;
      loserId = match.homeTeamId;
      status = "COMPLETED";
    }
  } else if (homeScore > awayScore) {
    winnerId = match.homeTeamId;
    loserId = match.awayTeamId;
  } else if (awayScore > homeScore) {
    winnerId = match.awayTeamId;
    loserId = match.homeTeamId;
  } else {
    // Marked final with the scores level and no forfeit — there is nobody to advance.
    return { ok: false, status: 400, error: "A completed match needs a winner" };
  }

  const completed = isDone(status);
  if (!completed) {
    winnerId = null;
    loserId = null;
  }

  // Roll back the previous result when the match stops being completed, or completes differently.
  const previousWinnerId = match.winnerId;
  const previousLoserId = otherTeam(match, previousWinnerId);
  const unadvance: UnadvanceStep[] = [];
  const mustUnadvance = isDone(match.status) && Boolean(previousWinnerId) && (!completed || winnerId !== previousWinnerId);

  if (mustUnadvance) {
    if (match.nextMatchId && previousWinnerId) {
      unadvance.push({
        matchId: match.nextMatchId,
        slot: resolveSlot(match.nextMatchSlot, match.matchOrder),
        teamId: previousWinnerId,
      });
    }
    if (match.loserNextMatchId && previousLoserId) {
      unadvance.push({
        matchId: match.loserNextMatchId,
        slot: resolveSlot(match.loserNextMatchSlot, match.matchOrder),
        teamId: previousLoserId,
      });
    }
  }

  const advance: AdvanceStep[] = [];
  if (completed && winnerId && match.nextMatchId) {
    advance.push({
      matchId: match.nextMatchId,
      slot: resolveSlot(match.nextMatchSlot, match.matchOrder),
      teamId: winnerId,
    });
  }
  if (completed && loserId && match.loserNextMatchId) {
    advance.push({
      matchId: match.loserNextMatchId,
      slot: resolveSlot(match.loserNextMatchSlot, match.matchOrder),
      teamId: loserId,
    });
  }

  return {
    ok: true,
    plan: { homeScore, awayScore, bestOf, scoreLimit, status, winnerId, loserId, resultType, unadvance, advance },
  };
}
