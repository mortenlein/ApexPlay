import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminApi } from '@/lib/route-auth';
import { buildAdminActorLabel, recordAudit } from '@/lib/audit';
import { conflictResponse, hasTimestampConflict, normalizeExpectedUpdatedAt } from '@/lib/mutation-guards';

export async function GET(request: Request, { params }: { params: { id: string } }) {
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

        return NextResponse.json(tournament);
    } catch (error: any) {
        console.error('Fetch tournament error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
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

        const data = {
            ...(typeof body.name === 'string' ? { name: body.name.trim() } : {}),
            ...(typeof body.bo3StartRound === 'number' || body.bo3StartRound === null
                ? { bo3StartRound: body.bo3StartRound }
                : {}),
            ...(typeof body.bo5StartRound === 'number' || body.bo5StartRound === null
                ? { bo5StartRound: body.bo5StartRound }
                : {}),
            ...(typeof body.hasThirdPlace === 'boolean' ? { hasThirdPlace: body.hasThirdPlace } : {}),
            ...(typeof body.steamSignupEnabled === 'boolean' ? { steamSignupEnabled: body.steamSignupEnabled } : {}),
            ...(typeof body.rosterLocked === 'boolean' ? { rosterLocked: body.rosterLocked } : {}),
            ...(typeof body.teamSize === 'number' ? { teamSize: body.teamSize } : {}),
            ...(typeof body.format === 'string' ? { format: body.format } : {}),
            ...(typeof body.type === 'string' ? { type: body.type } : {}),
        };

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
            actor: buildAdminActorLabel(),
            metadata: data,
        });
        return NextResponse.json(updated);
    } catch (error: any) {
        console.error('Update tournament error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
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
            actor: buildAdminActorLabel(),
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Delete tournament error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
