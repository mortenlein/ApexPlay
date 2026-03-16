import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request, { params }: { params: { id: string } }) {
    try {
        const tournamentId = params.id;
        const matches = await prisma.match.findMany({
            where: { tournamentId },
            select: {
                id: true,
                round: true,
                matchOrder: true,
                status: true,
                bestOf: true,
                scoreLimit: true,
                homeScore: true,
                awayScore: true,
                winnerId: true,
                homeTeamId: true,
                awayTeamId: true,
                mapScores: true,
                homeTeam: {
                    select: {
                        id: true,
                        name: true,
                        logoUrl: true,
                        players: {
                            select: { id: true, name: true, seating: true }
                        }
                    }
                },
                awayTeam: {
                    select: {
                        id: true,
                        name: true,
                        logoUrl: true,
                        players: {
                            select: { id: true, name: true, seating: true }
                        }
                    }
                }
            },
            orderBy: [
                { round: 'asc' },
                { matchOrder: 'asc' },
            ],
        });
        return NextResponse.json(matches);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
