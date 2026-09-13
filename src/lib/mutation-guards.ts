import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiErrorText, type ApiErrorCode, type ApiErrorParams } from "@/lib/api-errors";

/**
 * The refusal a human is meant to read.
 *
 * The body carries both halves: `error` is the canonical English sentence (what the log shows,
 * what `curl` shows, what the e2e suite asserts) and `code` is what the client translates for the
 * toast. Composing the sentence server-side in the caller's language was the obvious alternative
 * and is wrong here — half of these are read by nobody but a developer, and a Norwegian error in
 * a log is a Norwegian error in a log.
 */
export function errorResponse(code: ApiErrorCode, status: number, params?: ApiErrorParams) {
  return NextResponse.json(
    { error: apiErrorText(code, params), code, ...(params ? { params } : {}) },
    { status }
  );
}

/** 409: somebody else saved first. `expectedUpdatedAt` is the token that caught it. */
export function conflictResponse(code: ApiErrorCode = "stale_record") {
  return errorResponse(code, 409);
}

/**
 * 423: the tournament is locked against this change. Each call site names *which* lock it hit,
 * because "locked" alone leaves the organizer with nowhere to go — the message says what is still
 * editable and where the unlock lives.
 */
export function lockedResponse(code: ApiErrorCode) {
  return errorResponse(code, 423);
}

export function normalizeExpectedUpdatedAt(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function hasTimestampConflict(actual: Date, expectedUpdatedAt: string | null) {
  return Boolean(expectedUpdatedAt && actual.toISOString() !== expectedUpdatedAt);
}

export async function getTournamentLockState(tournamentId: string) {
  return prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      name: true,
      rosterLocked: true,
      updatedAt: true,
      _count: {
        select: {
          matches: true,
          teams: true,
        },
      },
    },
  });
}
