import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { resolveSteamId } from '@/lib/steam';
import { requireAdminApi, requireSignedInUser } from '@/lib/route-auth';
import { buildTeamsCsv, parseCsvRows } from '@/lib/csv';
import { buildAdminActorLabel, recordAudit } from '@/lib/audit';
import { lockedResponse } from '@/lib/mutation-guards';

export async function GET(request: Request, { params }: { params: { id: string } }) {
    const teams = await prisma.team.findMany({
        where: { tournamentId: params.id },
        select: {
            id: true,
            name: true,
            logoUrl: true,
            inviteCode: true,
            seed: true,
            updatedAt: true,
            players: {
                select: {
                    id: true,
                    name: true,
                    nickname: true,
                    countryCode: true,
                    seating: true,
                    steamId: true,
                    isLeader: true,
                    userId: true,
                    user: {
                        select: {
                            accounts: {
                                select: {
                                    provider: true
                                }
                            }
                        }
                    }
                }
            }
        },
        orderBy: { seed: 'asc' },
    });

    const format = new URL(request.url).searchParams.get('format');
    if (format === 'csv') {
        return new Response(buildTeamsCsv(teams), {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="tournament-${params.id}-teams.csv"`,
            },
        });
    }

    return NextResponse.json(teams);
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
    try {
        const body = await request.json();
        const tournament = await prisma.tournament.findUnique({
            where: { id: params.id },
            select: {
                id: true,
                name: true,
                teamSize: true,
                steamSignupEnabled: true,
                rosterLocked: true,
            },
        });

        if (!tournament) {
            return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
        }

        const adminUnauthorized = await requireAdminApi();
        const isAdminRequest = !adminUnauthorized;
        const userSession = await requireSignedInUser();

        if (!isAdminRequest && tournament.steamSignupEnabled && !userSession) {
            return NextResponse.json({ error: 'Sign in required for this tournament' }, { status: 401 });
        }

        if (tournament.rosterLocked) {
            return lockedResponse('Roster changes are locked. Unlock roster edits in tournament settings first.');
        }

        if (body.mode === 'import') {
            if (!isAdminRequest) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }

            const rows = parseCsvRows(String(body.csv || ''));
            if (rows.length === 0) {
                return NextResponse.json({ error: 'Add at least one CSV row to import.' }, { status: 400 });
            }

            const groupedTeams = new Map<string, any[]>();
            for (const row of rows) {
                const teamName = row.teamName.trim();
                if (!teamName) continue;
                if (!groupedTeams.has(teamName)) {
                    groupedTeams.set(teamName, []);
                }
                groupedTeams.get(teamName)!.push(row);
            }

            if (groupedTeams.size === 0) {
                return NextResponse.json({ error: 'CSV must include teamName values.' }, { status: 400 });
            }

            const createdTeams = await prisma.$transaction(async (tx) => {
                const items = [];
                for (const [teamName, rowsForTeam] of groupedTeams.entries()) {
                    const firstRow = rowsForTeam[0];
                    const team = await tx.team.create({
                        data: {
                            name: teamName,
                            seed: firstRow.seed ? Number(firstRow.seed) : null,
                            tournamentId: params.id,
                            logoUrl: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(teamName)}`,
                            players: {
                                create: rowsForTeam
                                    .filter((row) => row.playerName || row.nickname)
                                    .map((row) => ({
                                        name: row.playerName || row.nickname || 'Player',
                                        nickname: row.nickname || null,
                                        countryCode: row.countryCode || null,
                                        seating: row.seating || null,
                                        steamId: row.steamId || null,
                                        tournamentId: params.id,
                                        isLeader: String(row.isLeader).toLowerCase() === 'true',
                                    })),
                            },
                        },
                    });
                    items.push(team);
                }
                return items;
            });

            await recordAudit({
                action: 'team.imported',
                entityType: 'tournament',
                entityId: params.id,
                tournamentId: params.id,
                summary: `Imported ${createdTeams.length} teams into ${tournament.name}`,
                actor: buildAdminActorLabel(),
                metadata: { teamCount: createdTeams.length },
            });

            return NextResponse.json({ success: true, count: createdTeams.length });
        }

        const { name, logoUrl, seed, players } = body;
        const trimmedName = typeof name === 'string' ? name.trim() : '';
        if (!trimmedName) {
            return NextResponse.json({ error: 'Team name is required' }, { status: 400 });
        }

        let finalLogoUrl = logoUrl;
        if (!finalLogoUrl || finalLogoUrl.trim() === '') {
            finalLogoUrl = `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(trimmedName)}`;
        }

        const resolvedPlayers = await Promise.all(
            Array.isArray(players) ? players.map(async (p: any) => ({
                name: p.name,
                nickname: p.nickname || null,
                countryCode: p.countryCode || null,
                seating: p.seating || null,
                steamId: p.steamId ? await resolveSteamId(p.steamId) : null,
                tournamentId: params.id,
            })) : []
        );

        if (!isAdminRequest && resolvedPlayers.length < tournament.teamSize) {
            return NextResponse.json(
                { error: `This tournament requires ${tournament.teamSize} players per team` },
                { status: 400 }
            );
        }

        const team = await prisma.team.create({
            data: {
                name: trimmedName,
                logoUrl: finalLogoUrl,
                seed: seed ? parseInt(seed) : null,
                tournamentId: params.id,
                players: {
                    create: resolvedPlayers
                }
            },
        });

        await recordAudit({
            action: 'team.created',
            entityType: 'team',
            entityId: team.id,
            tournamentId: params.id,
            summary: `Added team ${team.name}`,
            actor: isAdminRequest ? buildAdminActorLabel() : userSession?.user?.name || 'Signed-in player',
            metadata: {
                playerCount: resolvedPlayers.length,
            },
        });

        return NextResponse.json(team);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
