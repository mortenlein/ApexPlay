import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getAuthOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
    const view = new URL(request.url).searchParams.get('view');
    const profileView = view === 'profile';
    const session = await getServerSession(getAuthOptions(undefined)) as any;
    
    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: {
                accounts: true
            }
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Find all player entries for tournaments they have joined
        const registrations = await prisma.player.findMany({
            where: { userId: user.id },
            include: {
                team: {
                    include: {
                        tournament: {
                            select: {
                                id: true,
                                name: true,
                                game: true,
                                createdAt: true
                            }
                        },
                        ...(profileView
                            ? {}
                            : {
                                players: {
                                    select: {
                                        id: true,
                                        name: true,
                                        seating: true,
                                    }
                                },
                                _count: {
                                    select: { players: true }
                                }
                            }),
                    }
                }
            },
            orderBy: {
                team: {
                    tournament: {
                        createdAt: 'desc'
                    }
                }
            }
        });

        const teamIds = registrations.map((registration) => registration.teamId);
        const activeMatchesCount = teamIds.length === 0
            ? 0
            : await prisma.match.count({
                where: {
                    status: { not: 'COMPLETED' },
                    OR: [
                        { homeTeamId: { in: teamIds } },
                        { awayTeamId: { in: teamIds } },
                    ],
                },
            });
        const activeMatches = profileView || teamIds.length === 0
            ? []
            : await prisma.match.findMany({
                where: {
                    status: { not: 'COMPLETED' },
                    OR: [
                        { homeTeamId: { in: teamIds } },
                        { awayTeamId: { in: teamIds } },
                    ],
                },
                include: {
                    tournament: {
                        select: {
                            id: true,
                            name: true,
                            game: true,
                        },
                    },
                    homeTeam: {
                        include: {
                            players: {
                                select: {
                                    id: true,
                                    name: true,
                                    seating: true,
                                }
                            }
                        }
                    },
                    awayTeam: {
                        include: {
                            players: {
                                select: {
                                    id: true,
                                    name: true,
                                    seating: true,
                                }
                            }
                        }
                    },
                },
                orderBy: {
                    round: 'asc',
                }
            });

        const teamsLed = registrations.filter((registration) => registration.isLeader).length;
        const seatAssignments = registrations.filter((registration) => registration.seating).length;
        const connectedAccounts = user.accounts.length;
        const tournamentsJoined = registrations.length;

        const enrichedMatches = activeMatches.map((match) => {
            const playerTeamId = match.homeTeamId && teamIds.includes(match.homeTeamId)
                ? match.homeTeamId
                : match.awayTeamId;

            return {
                ...match,
                playerTeamId,
            };
        });

        return NextResponse.json({
            user,
            registrations,
            activeMatches: enrichedMatches,
            stats: {
                tournamentsJoined,
                teamsLed,
                connectedAccounts,
                seatAssignments,
                activeMatches: activeMatchesCount,
                liveMatches: enrichedMatches.filter((match) => match.status === 'LIVE').length,
            }
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
