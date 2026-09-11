import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isStaffAuthenticated } from '@/lib/route-auth';

// Reads the session to decide whether player steamIds are included; never prerender.
export const dynamic = 'force-dynamic';

type PublicPlayer = { id: string; name: string; seating: string | null; isOnline: boolean };

/** Player steamIds are staff-only; seating and presence stay public for the bracket. */
function toPublicTeam<T extends { players: (PublicPlayer & { steamId: string | null })[] }>(team: T | null) {
    if (!team) {
        return team;
    }

    return {
        ...team,
        players: team.players.map(({ id, name, seating, isOnline }): PublicPlayer => ({
            id,
            name,
            seating,
            isOnline,
        })),
    };
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
    try {
        const tournamentId = params.id;
        const isStaff = await isStaffAuthenticated();
        const matches = await prisma.match.findMany({
            where: { tournamentId },
            select: {
                id: true,
                round: true,
                matchOrder: true,
                status: true,
                bracketType: true,
                bestOf: true,
                scoreLimit: true,
                homeScore: true,
                awayScore: true,
                updatedAt: true,
                winnerId: true,
                nextMatchId: true,
                loserNextMatchId: true,
                homeTeamId: true,
                awayTeamId: true,
                mapScores: true,
                homeTeam: {
                    select: {
                        id: true,
                        name: true,
                        logoUrl: true,
                        seed: true,
                        players: {
                            select: { id: true, name: true, seating: true, steamId: true, isOnline: true }
                        }
                    }
                },
                awayTeam: {
                    select: {
                        id: true,
                        name: true,
                        logoUrl: true,
                        seed: true,
                        players: {
                            select: { id: true, name: true, seating: true, steamId: true, isOnline: true }
                        }
                    }
                }
            },
            orderBy: [
                { round: 'asc' },
                { matchOrder: 'asc' },
            ],
        });
        if (isStaff) {
            return NextResponse.json(matches);
        }

        return NextResponse.json(
            matches.map((match) => ({
                ...match,
                homeTeam: toPublicTeam(match.homeTeam),
                awayTeam: toPublicTeam(match.awayTeam),
            }))
        );
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
