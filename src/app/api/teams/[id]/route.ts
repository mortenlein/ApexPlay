import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminApi } from '@/lib/route-auth';
import { buildActorLabel, recordAudit } from '@/lib/audit';
import { conflictResponse, hasTimestampConflict, lockedResponse, normalizeExpectedUpdatedAt } from '@/lib/mutation-guards';

/**
 * Lock semantics for a team row:
 *  - `name` / `logoUrl` are cosmetic and stay editable even when the roster is locked — a typo in
 *    a team name has to be fixable mid-tournament, when it is on the bracket and the stream HUD.
 *  - `seed` decides bracket placement, so it is refused (423) once roster edits are locked; the
 *    bracket is already built from the old seeding at that point.
 */
export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
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

        const seedProvided = body.seed !== undefined;
        if (team.tournament.rosterLocked && seedProvided) {
            return lockedResponse('seeding_locked');
        }

        const expectedUpdatedAt = normalizeExpectedUpdatedAt(body.expectedUpdatedAt);
        if (hasTimestampConflict(team.updatedAt, expectedUpdatedAt)) {
            return conflictResponse();
        }

        const trimmedName = typeof body.name === 'string' ? body.name.trim() : undefined;
        if (trimmedName !== undefined && trimmedName.length === 0) {
            return NextResponse.json({ error: 'Team name cannot be empty' }, { status: 400 });
        }

        const data = {
            ...(trimmedName ? { name: trimmedName.slice(0, 64) } : {}),
            ...(typeof body.logoUrl === 'string' ? { logoUrl: body.logoUrl.trim() || null } : {}),
            ...(body.seed === '' || body.seed === null ? { seed: null } : {}),
            ...(seedProvided && body.seed !== '' && body.seed !== null ? { seed: Number(body.seed) } : {}),
        };

        if (Object.keys(data).length === 0) {
            return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
        }

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
            actor: await buildActorLabel(),
            metadata: data,
        });

        return NextResponse.json(updatedTeam);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * Remove a team.
 *
 * While the roster is locked the caller must opt in with `?force=1`: the team is already placed in
 * the bracket, so pulling it out is a deliberate act (a no-show being withdrawn mid-event), not an
 * accidental click.
 *
 * The referencing matches are detached explicitly, inside the delete transaction. `homeTeamId` /
 * `awayTeamId` are optional relations, so the schema's implicit `ON DELETE SET NULL` would already
 * blank those slots — but `winnerId` is a bare column with no foreign key and would be left
 * pointing at a team that no longer exists. Doing it by hand also yields the count of affected
 * matches, which the UI reports back to staff.
 */
export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const unauthorized = await requireAdminApi();
    if (unauthorized) return unauthorized;

    try {
        const force = new URL(request.url).searchParams.get('force') === '1';
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

        if (team.tournament.rosterLocked && !force) {
            return lockedResponse('roster_locked_force');
        }

        const matchesAffected = await prisma.$transaction(async (tx) => {
            const placements = await tx.match.findMany({
                where: {
                    OR: [
                        { homeTeamId: params.id },
                        { awayTeamId: params.id },
                        { winnerId: params.id },
                    ],
                },
                select: { id: true, homeTeamId: true, awayTeamId: true, winnerId: true },
            });

            for (const match of placements) {
                await tx.match.update({
                    where: { id: match.id },
                    data: {
                        ...(match.homeTeamId === params.id ? { homeTeamId: null } : {}),
                        ...(match.awayTeamId === params.id ? { awayTeamId: null } : {}),
                        ...(match.winnerId === params.id ? { winnerId: null } : {}),
                    },
                });
            }

            await tx.team.delete({ where: { id: params.id } });

            return placements.length;
        });

        await recordAudit({
            action: 'team.deleted',
            entityType: 'team',
            entityId: team.id,
            tournamentId: team.tournamentId,
            summary: matchesAffected > 0
                ? `Removed team ${team.name} and cleared it from ${matchesAffected} match(es)`
                : `Removed team ${team.name}`,
            actor: await buildActorLabel(),
            metadata: { forced: force, matchesAffected },
        });

        return NextResponse.json({ success: true, matchesAffected });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
