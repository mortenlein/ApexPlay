import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request, { params }: { params: { id: string } }) {
    try {
        const body = await request.json();
        const { homeScore, awayScore, mapScores, bestOf, scoreLimit } = body;

        const match = await prisma.match.findUnique({
            where: { id: params.id },
            include: { homeTeam: true, awayTeam: true }
        });

        if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

        let winnerId = null;
        let loserId = null;
        let status = 'IN_PROGRESS';

        // Determine if a team has reached the score limit
        if (homeScore >= match.scoreLimit) {
            winnerId = match.homeTeamId;
            loserId = match.awayTeamId;
            status = 'COMPLETED';
        } else if (awayScore >= match.scoreLimit) {
            winnerId = match.awayTeamId;
            loserId = match.homeTeamId;
            status = 'COMPLETED';
        }

        // Update current match
        const updatedMatch = await prisma.match.update({
            where: { id: params.id },
            data: {
                ...(homeScore !== undefined && { homeScore }),
                ...(awayScore !== undefined && { awayScore }),
                ...(mapScores !== undefined && { mapScores: typeof mapScores === 'string' ? mapScores : JSON.stringify(mapScores) }),
                ...(bestOf !== undefined && { bestOf }),
                ...(scoreLimit !== undefined && { scoreLimit }),
                winnerId,
                status
            }
        });

        // Auto-advance winner
        if (winnerId && match.nextMatchId) {
            const isNextHome = match.matchOrder % 2 === 0;
            await prisma.match.update({
                where: { id: match.nextMatchId },
                data: {
                    ...(isNextHome ? { homeTeamId: winnerId } : { awayTeamId: winnerId })
                }
            });
        }

        // Auto-advance loser (for Double Elim or 3rd place matches)
        if (loserId && match.loserNextMatchId) {
            const isNextHome = match.matchOrder % 2 === 0;
            await prisma.match.update({
                where: { id: match.loserNextMatchId },
                data: {
                    ...(isNextHome ? { homeTeamId: loserId } : { awayTeamId: loserId })
                }
            });
        }

        return NextResponse.json(updatedMatch);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
