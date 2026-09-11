import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireStaffApi } from '@/lib/route-auth';
import { buildActorLabel, recordAudit } from '@/lib/audit';
import { resolveSteamId } from '@/lib/steam';
import { conflictResponse, hasTimestampConflict, lockedResponse, normalizeExpectedUpdatedAt } from '@/lib/mutation-guards';

export const dynamic = 'force-dynamic';

const MAX_TEXT = 64;
const MAX_SEATING = 16;

/** Trim + cap a free-text field. `''` normalises to null so staff can clear a field. */
function cleanText(value: unknown, max = MAX_TEXT) {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    return trimmed.slice(0, max);
}

/**
 * Staff editor for a single player row.
 *
 * Lock semantics: a locked roster (bracket already generated) still has to allow the corrections
 * that happen on the LAN floor — seat assignment, a misspelled name, a nickname, a flag. Only the
 * fields that change *who* is playing (`steamId`) or *who speaks for the team* (`isLeader`) are
 * refused while the roster is locked.
 */
export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const unauthorized = await requireStaffApi();
    if (unauthorized) return unauthorized;

    try {
        const body = await request.json();
        const player = await prisma.player.findUnique({
            where: { id: params.id },
            include: {
                tournament: { select: { id: true, rosterLocked: true } },
                team: { select: { id: true, name: true } },
            },
        });

        if (!player) {
            return NextResponse.json({ error: 'Player not found' }, { status: 404 });
        }

        const expectedUpdatedAt = normalizeExpectedUpdatedAt(body.expectedUpdatedAt);
        if (hasTimestampConflict(player.updatedAt, expectedUpdatedAt)) {
            return conflictResponse();
        }

        const identityChange = body.steamId !== undefined || body.isLeader !== undefined;
        if (player.tournament.rosterLocked && identityChange) {
            return lockedResponse(
                'Roster changes are locked. Seat, name, nickname and flag edits are still allowed; Steam ID and leader changes need roster edits unlocked.'
            );
        }

        const name = cleanText(body.name);
        if (body.name !== undefined && !name) {
            return NextResponse.json({ error: 'Player name cannot be empty' }, { status: 400 });
        }

        const rawSteamId = body.steamId === undefined ? undefined : cleanText(body.steamId);
        let steamId: string | null | undefined = undefined;
        if (rawSteamId === null) {
            steamId = null;
        } else if (typeof rawSteamId === 'string') {
            steamId = await resolveSteamId(rawSteamId);
            if (!steamId) {
                return NextResponse.json({ error: 'Could not resolve that Steam ID or vanity URL' }, { status: 400 });
            }
        }

        const data = {
            ...(name ? { name } : {}),
            ...(body.nickname !== undefined ? { nickname: cleanText(body.nickname) } : {}),
            ...(body.countryCode !== undefined ? { countryCode: cleanText(body.countryCode, 8) } : {}),
            ...(body.seating !== undefined ? { seating: cleanText(body.seating, MAX_SEATING) } : {}),
            ...(body.isLeader !== undefined ? { isLeader: Boolean(body.isLeader) } : {}),
            ...(steamId !== undefined ? { steamId } : {}),
        };

        if (Object.keys(data).length === 0) {
            return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
        }

        const updated = await prisma.player.update({
            where: { id: params.id },
            data,
        });

        await recordAudit({
            action: 'player.updated',
            entityType: 'player',
            entityId: updated.id,
            tournamentId: updated.tournamentId,
            summary: `Updated ${updated.name} on ${player.team.name}`,
            actor: await buildActorLabel(),
            metadata: data,
        });

        return NextResponse.json(updated);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/** Removing a player changes who is eligible to play, so it stays behind the roster lock. */
export async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const unauthorized = await requireStaffApi();
    if (unauthorized) return unauthorized;

    try {
        const player = await prisma.player.findUnique({
            where: { id: params.id },
            include: {
                tournament: { select: { rosterLocked: true } },
                team: { select: { name: true } },
            },
        });

        if (!player) {
            return NextResponse.json({ error: 'Player not found' }, { status: 404 });
        }

        if (player.tournament.rosterLocked) {
            return lockedResponse('Roster changes are locked. Unlock roster edits in tournament settings first.');
        }

        await prisma.player.delete({ where: { id: params.id } });

        await recordAudit({
            action: 'player.deleted',
            entityType: 'player',
            entityId: player.id,
            tournamentId: player.tournamentId,
            summary: `Removed ${player.name} from ${player.team.name}`,
            actor: await buildActorLabel(),
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
