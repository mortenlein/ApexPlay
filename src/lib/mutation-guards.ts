import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export function conflictResponse(message = "This record changed in another session. Refresh and try again.") {
  return NextResponse.json({ error: message }, { status: 409 });
}

export function lockedResponse(message = "Roster and bracket changes are locked for this tournament.") {
  return NextResponse.json({ error: message }, { status: 423 });
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
