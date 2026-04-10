import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import { announceSignup } from '@/lib/discord';
import { requireSignedInUser } from '@/lib/route-auth';
import { recordAudit } from '@/lib/audit';

export async function POST(request: Request, { params }: { params: { id: string } }) {
    const session = await requireSignedInUser();
    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: tournamentId } = params;
    
    // Fetch tournament to get its name
    const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        select: {
            id: true,
            name: true,
            steamSignupEnabled: true,
            rosterLocked: true,
            teamSize: true,
        },
    });

    if (!tournament) {
        return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }
    if (!tournament.steamSignupEnabled) {
        return NextResponse.json({ error: 'Steam signups are disabled for this tournament' }, { status: 403 });
    }
    if (tournament.rosterLocked) {
        return NextResponse.json({ error: 'Registration is currently locked for this tournament' }, { status: 423 });
    }

    const body = await request.json();
    const { action, teamName, logoUrl, inviteCode } = body;

    const sessionSteamId = ((session.user as any)?.steamId as string | undefined)?.trim();
    let user = await prisma.user.findUnique({
        where: { id: session.user.id },
    });

    if (!user && sessionSteamId) {
        user = await prisma.user.findUnique({
            where: { steamId: sessionSteamId },
        });
    }

    if (user && !user.steamId && sessionSteamId) {
        user = await prisma.user.update({
            where: { id: user.id },
            data: { steamId: sessionSteamId },
        });
    }

    if (!user || !user.steamId) {
        return NextResponse.json({ error: 'Steam sign-in required. Please continue with Steam and try again.' }, { status: 400 });
    }

    try {
        if (action === 'CREATE_TEAM') {
            const trimmedTeamName = typeof teamName === "string" ? teamName.trim() : "";
            if (!trimmedTeamName) {
                return NextResponse.json({ error: "Team name is required" }, { status: 400 });
            }

            const team = await prisma.$transaction(async (tx) => {
                const existingPlayer = await tx.player.findFirst({
                    where: {
                        tournamentId,
                        userId: user.id,
                    },
                });

                if (existingPlayer) {
                    throw new Error('You are already registered for this tournament');
                }

                return tx.team.create({
                    data: {
                        name: trimmedTeamName,
                        logoUrl: logoUrl,
                        tournamentId,
                        inviteCode: uuidv4().slice(0, 8),
                        players: {
                            create: {
                                name: session.user.name || 'Unknown',
                                steamId: user.steamId,
                                isLeader: true,
                                userId: user.id,
                                tournamentId,
                            }
                        }
                    },
                    include: {
                        players: true,
                    },
                });
            });

            await announceSignup({
                playerName: session.user.name || 'Unknown',
                teamName: team.name,
                tournamentName: tournament.name,
                tournamentId,
            });

            await recordAudit({
                action: 'signup.created_team',
                entityType: 'team',
                entityId: team.id,
                tournamentId,
                summary: `${session.user.name || 'Player'} created team ${team.name}`,
                actor: session.user.name || 'Signed-in player',
            });

            return NextResponse.json(team);
        } else if (action === 'JOIN_TEAM') {
            const team = await prisma.$transaction(async (tx) => {
                const existingPlayer = await tx.player.findFirst({
                    where: {
                        tournamentId,
                        userId: user.id,
                    },
                });

                if (existingPlayer) {
                    throw new Error('You are already registered for this tournament');
                }

                const teamRecord = await tx.team.findUnique({
                    where: { inviteCode: inviteCode as string },
                    include: { 
                        _count: { select: { players: true } },
                        tournament: true
                    }
                });

                if (!teamRecord) {
                    throw new Error('Invalid invite code');
                }

                if (teamRecord.tournamentId !== tournamentId) {
                    throw new Error('Team is not part of this tournament');
                }

                if (teamRecord._count.players >= teamRecord.tournament.teamSize) {
                    throw new Error('Team is already full');
                }

                await tx.player.create({
                    data: {
                        name: session.user.name || 'Unknown',
                        steamId: user.steamId,
                        teamId: teamRecord.id,
                        tournamentId,
                        userId: user.id,
                    }
                });

                return tx.team.findUnique({
                    where: { id: teamRecord.id },
                    include: {
                        players: true,
                    },
                });
            });

            if (!team) {
                return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 });
            }

            await announceSignup({
                playerName: session.user.name || 'Unknown',
                teamName: team.name,
                tournamentName: tournament.name,
                tournamentId,
            });

            await recordAudit({
                action: 'signup.joined_team',
                entityType: 'team',
                entityId: team.id,
                tournamentId,
                summary: `${session.user.name || 'Player'} joined team ${team.name}`,
                actor: session.user.name || 'Signed-in player',
            });

            return NextResponse.json(team);
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: any) {
        console.error('Signup error:', error);
        const message = error?.message || 'Signup failed';
        const status =
            message === 'Invalid invite code' ? 404 :
            message === 'Unauthorized' ? 401 :
            message.includes('already') || message.includes('full') || message.includes('not part') ? 400 :
            500;

        return NextResponse.json({ error: message }, { status });
    }
}
