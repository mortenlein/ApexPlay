import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireSignedInUser } from '@/lib/route-auth';
import { buildActorLabel, recordAudit } from '@/lib/audit';
import { lockedResponse } from '@/lib/mutation-guards';

// Session-gated + DB per request; never prerender at build time.
export const dynamic = 'force-dynamic';

const SEATING_MAX_LENGTH = 16;
const NICKNAME_MAX_LENGTH = 32;

/**
 * Normalizes a free-text self-service field: trims, caps the length, and treats an empty
 * string as "clear this field" (null) rather than an empty value.
 */
function normalizeOptionalText(value: unknown, maxLength: number): string | null | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.slice(0, maxLength);
}

/** The caller's own Player row in a tournament — the only row these handlers ever touch. */
async function findOwnPlayer(userId: string, tournamentId: string) {
    return prisma.player.findFirst({
        where: { tournamentId, userId },
        select: {
            id: true,
            name: true,
            nickname: true,
            seating: true,
            isLeader: true,
            teamId: true,
            tournamentId: true,
            team: { select: { id: true, name: true } },
        },
    });
}

/**
 * PATCH /api/me/player  body: { tournamentId, seating?, nickname? }
 *
 * Player self-service for their OWN row only (looked up by session user + tournament).
 * Deliberately allowed while the roster is locked: seats change on the LAN floor after the
 * bracket goes live, and a marshal looking for a player needs the current seat.
 */
export async function PATCH(request: Request) {
    const session = await requireSignedInUser();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: any;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const tournamentId = typeof body?.tournamentId === 'string' ? body.tournamentId.trim() : '';
    if (!tournamentId) {
        return NextResponse.json({ error: 'tournamentId is required' }, { status: 400 });
    }

    const seating = normalizeOptionalText(body?.seating, SEATING_MAX_LENGTH);
    const nickname = normalizeOptionalText(body?.nickname, NICKNAME_MAX_LENGTH);

    if (seating === undefined && nickname === undefined) {
        return NextResponse.json({ error: 'Nothing to update. Send seating and/or nickname.' }, { status: 400 });
    }

    const player = await findOwnPlayer(session.user.id, tournamentId);
    if (!player) {
        return NextResponse.json({ error: 'You are not registered for this tournament' }, { status: 404 });
    }

    const updated = await prisma.player.update({
        where: { id: player.id },
        data: {
            ...(seating !== undefined ? { seating } : {}),
            ...(nickname !== undefined ? { nickname } : {}),
        },
        select: {
            id: true,
            name: true,
            nickname: true,
            seating: true,
            isLeader: true,
            teamId: true,
            tournamentId: true,
        },
    });

    const changes: string[] = [];
    if (seating !== undefined) changes.push(`seat ${seating ? `→ ${seating}` : 'cleared'}`);
    if (nickname !== undefined) changes.push(`nickname ${nickname ? `→ ${nickname}` : 'cleared'}`);

    await recordAudit({
        action: 'player.self_updated',
        entityType: 'player',
        entityId: updated.id,
        tournamentId,
        summary: `${updated.name} updated their own ${changes.join(' and ')}`,
        actor: await buildActorLabel(),
        metadata: {
            teamId: updated.teamId,
            ...(seating !== undefined ? { seating } : {}),
            ...(nickname !== undefined ? { nickname } : {}),
        },
    });

    return NextResponse.json({ player: updated });
}

/**
 * DELETE /api/me/player?tournamentId=…  — "leave team".
 *
 * Only while the roster is unlocked: once the bracket exists, removing a player would change
 * a team that is already seeded into matches, so that becomes an organizer action.
 * Leader handover: the earliest-joined remaining player is promoted; an emptied team is
 * deleted so it never lingers as a ghost entry on the roster.
 */
export async function DELETE(request: Request) {
    const session = await requireSignedInUser();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tournamentId = (new URL(request.url).searchParams.get('tournamentId') || '').trim();
    if (!tournamentId) {
        return NextResponse.json({ error: 'tournamentId is required' }, { status: 400 });
    }

    const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        select: { id: true, name: true, rosterLocked: true },
    });
    if (!tournament) {
        return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }
    if (tournament.rosterLocked) {
        return lockedResponse('The bracket is live — ask an organizer to move you.');
    }

    const player = await findOwnPlayer(session.user.id, tournamentId);
    if (!player) {
        return NextResponse.json({ error: 'You are not registered for this tournament' }, { status: 404 });
    }

    try {
        const result = await prisma.$transaction(async (tx) => {
            await tx.player.delete({ where: { id: player.id } });

            const remaining = await tx.player.findMany({
                where: { teamId: player.teamId },
                // Player has no createdAt; updatedAt defaults to the row's creation time, so
                // ascending updatedAt is the closest available "earliest joined" ordering.
                orderBy: { updatedAt: 'asc' },
                select: { id: true, name: true, isLeader: true },
            });

            if (remaining.length === 0) {
                // Safety net: a team wired into matches must never be deleted out from under
                // the bracket, even if the roster lock was somehow cleared.
                const matchCount = await tx.match.count({
                    where: { OR: [{ homeTeamId: player.teamId }, { awayTeamId: player.teamId }] },
                });
                if (matchCount === 0) {
                    await tx.team.delete({ where: { id: player.teamId } });
                    return { teamDeleted: true, promoted: null as { id: string; name: string } | null };
                }
                return { teamDeleted: false, promoted: null as { id: string; name: string } | null };
            }

            if (player.isLeader && !remaining.some((candidate) => candidate.isLeader)) {
                const heir = remaining[0];
                await tx.player.update({ where: { id: heir.id }, data: { isLeader: true } });
                return { teamDeleted: false, promoted: { id: heir.id, name: heir.name } };
            }

            return { teamDeleted: false, promoted: null as { id: string; name: string } | null };
        });

        const teamName = player.team?.name || 'their team';
        await recordAudit({
            action: 'player.left_team',
            entityType: 'team',
            entityId: player.teamId,
            tournamentId,
            summary:
                `${player.name} left ${teamName}` +
                (result.teamDeleted
                    ? ' (team removed — no players left)'
                    : result.promoted
                        ? ` (${result.promoted.name} promoted to leader)`
                        : ''),
            actor: await buildActorLabel(),
            metadata: {
                playerId: player.id,
                teamId: player.teamId,
                teamDeleted: result.teamDeleted,
                promotedPlayerId: result.promoted?.id ?? null,
            },
        });

        return NextResponse.json({
            success: true,
            teamDeleted: result.teamDeleted,
            promotedPlayerId: result.promoted?.id ?? null,
        });
    } catch (error: any) {
        console.error('Leave team failed:', error);
        return NextResponse.json({ error: error?.message || 'Could not leave the team' }, { status: 500 });
    }
}
