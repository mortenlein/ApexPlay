import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminApi } from '@/lib/route-auth';
import { buildAdminActorLabel, recordAudit } from '@/lib/audit';
import { conflictResponse, hasTimestampConflict, lockedResponse, normalizeExpectedUpdatedAt } from '@/lib/mutation-guards';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
    const unauthorized = await requireAdminApi();
    if (unauthorized) return unauthorized;

    try {
        const body = await request.json();
        const team = await prisma.team.findUnique({
            where: { id: params.id },
            include: {
                tournament: {
                    select: {
                        id: true,
                        rosterLocked: true,
                    },
                },
            },
        });

        if (!team) {
            return NextResponse.json({ error: 'Team not found' }, { status: 404 });
        }

        if (team.tournament.rosterLocked) {
            return lockedResponse('Roster changes are locked. Unlock roster edits in tournament settings first.');
        }

        const expectedUpdatedAt = normalizeExpectedUpdatedAt(body.expectedUpdatedAt);
        if (hasTimestampConflict(team.updatedAt, expectedUpdatedAt)) {
            return conflictResponse();
        }

        const data = {
            ...(typeof body.name === 'string' ? { name: body.name.trim() } : {}),
            ...(typeof body.logoUrl === 'string' ? { logoUrl: body.logoUrl.trim() } : {}),
            ...(body.seed === '' || body.seed === null ? { seed: null } : {}),
            ...(body.seed !== undefined && body.seed !== '' && body.seed !== null ? { seed: Number(body.seed) } : {}),
        };

        const updatedTeam = await prisma.team.update({
            where: { id: params.id },
            data,
        });

        await recordAudit({
            action: 'team.updated',
            entityType: 'team',
            entityId: updatedTeam.id,
            tournamentId: updatedTeam.tournamentId,
            summary: `Updated team ${updatedTeam.name}`,
            actor: buildAdminActorLabel(),
            metadata: data,
        });

        return NextResponse.json(updatedTeam);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    const unauthorized = await requireAdminApi();
    if (unauthorized) return unauthorized;

    try {
        const team = await prisma.team.findUnique({
            where: { id: params.id },
            include: {
                tournament: {
                    select: {
                        rosterLocked: true,
                    },
                },
            },
        });

        if (!team) {
            return NextResponse.json({ error: 'Team not found' }, { status: 404 });
        }

        if (team.tournament.rosterLocked) {
            return lockedResponse('Roster changes are locked. Unlock roster edits in tournament settings first.');
        }

        await prisma.team.delete({
            where: { id: params.id },
        });

        await recordAudit({
            action: 'team.deleted',
            entityType: 'team',
            entityId: team.id,
            tournamentId: team.tournamentId,
            summary: `Removed team ${team.name}`,
            actor: buildAdminActorLabel(),
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
