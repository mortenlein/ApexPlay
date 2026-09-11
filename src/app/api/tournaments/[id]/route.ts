import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { requireAdminApi, isAdminAuthenticated } from '@/lib/route-auth';
import { buildActorLabel, recordAudit } from '@/lib/audit';
import { conflictResponse, hasTimestampConflict, normalizeExpectedUpdatedAt } from '@/lib/mutation-guards';
import {
    LAST_ROUNDS_MAX,
    getGameMetadata,
    isTournamentFormat,
    isValidLastRounds,
} from '@/lib/games';

const badRequest = (error: string) => NextResponse.json({ error }, { status: 400 });

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    try {
        const tournament = await prisma.tournament.findUnique({
            where: { id: params.id },
            include: {
                _count: {
                    select: { teams: true, matches: true }
                }
            }
        });

        if (!tournament) {
            return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
        }

        // The EON bridge token is a webhook bearer credential — admins only.
        if (!(await isAdminAuthenticated())) {
            const { eonBridgeToken: _token, ...publicTournament } = tournament;
            return NextResponse.json(publicTournament);
        }

        return NextResponse.json(tournament);
    } catch (error: any) {
        console.error('Fetch tournament error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const unauthorized = await requireAdminApi();
    if (unauthorized) return unauthorized;

    try {
        const body = await request.json();
        const expectedUpdatedAt = normalizeExpectedUpdatedAt(body.expectedUpdatedAt);
        const currentTournament = await prisma.tournament.findUnique({
            where: { id: params.id },
        });

        if (!currentTournament) {
            return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
        }

        if (hasTimestampConflict(currentTournament.updatedAt, expectedUpdatedAt)) {
            return conflictResponse();
        }

        const data: Prisma.TournamentUpdateInput = {
            ...(typeof body.hasThirdPlace === 'boolean' ? { hasThirdPlace: body.hasThirdPlace } : {}),
            ...(typeof body.steamSignupEnabled === 'boolean' ? { steamSignupEnabled: body.steamSignupEnabled } : {}),
            ...(typeof body.rosterLocked === 'boolean' ? { rosterLocked: body.rosterLocked } : {}),
            ...(typeof body.type === 'string' ? { type: body.type } : {}),
        };

        if (body.name !== undefined) {
            if (typeof body.name !== 'string' || !body.name.trim()) {
                return badRequest('Tournament name is required');
            }
            data.name = body.name.trim();
        }

        if (body.format !== undefined) {
            if (!isTournamentFormat(body.format)) {
                return badRequest('Format must be SINGLE_ELIMINATION or DOUBLE_ELIMINATION');
            }
            data.format = body.format;
            // `type` mirrors `format` (the create route stores `type: data.type || format`),
            // so keep them in sync unless the caller supplied an explicit type.
            if (typeof body.type !== 'string') {
                data.type = body.format;
            }
        }

        if (body.teamSize !== undefined) {
            const gameMeta = getGameMetadata(currentTournament.game);
            if (!gameMeta) {
                return badRequest('Unsupported game');
            }
            if (typeof body.teamSize !== 'number' || !Number.isInteger(body.teamSize) || !gameMeta.teamSize.includes(body.teamSize)) {
                return badRequest(
                    `Team size must be one of ${gameMeta.teamSize.join(', ')} for ${gameMeta.name}`
                );
            }
            data.teamSize = body.teamSize;
        }

        for (const field of ['bo3LastRounds', 'bo5LastRounds'] as const) {
            if (body[field] === undefined) continue;
            if (!isValidLastRounds(body[field])) {
                return badRequest(`${field} must be an integer between 0 and ${LAST_ROUNDS_MAX}, or null`);
            }
            // 0 means "off" and is stored as null.
            data[field] = body[field] === 0 ? null : body[field];
        }

        if (Object.keys(data).length === 0) {
            return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
        }

        const updated = await prisma.tournament.update({
            where: { id: params.id },
            data
        });

        await recordAudit({
            action: 'tournament.updated',
            entityType: 'tournament',
            entityId: updated.id,
            tournamentId: updated.id,
            summary: `Updated tournament settings for ${updated.name}`,
            actor: await buildActorLabel(),
            metadata: data,
        });
        return NextResponse.json(updated);
    } catch (error: any) {
        console.error('Update tournament error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const unauthorized = await requireAdminApi();
    if (unauthorized) return unauthorized;

    try {
        const currentTournament = await prisma.tournament.findUnique({
            where: { id: params.id },
        });

        if (!currentTournament) {
            return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
        }

        await prisma.tournament.delete({
            where: { id: params.id },
        });

        await recordAudit({
            action: 'tournament.deleted',
            entityType: 'tournament',
            entityId: params.id,
            tournamentId: params.id,
            summary: `Deleted tournament ${currentTournament.name}`,
            actor: await buildActorLabel(),
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Delete tournament error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
