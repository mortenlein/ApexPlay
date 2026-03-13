import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request, { params }: { params: { id: string } }) {
    try {
        const tournamentId = params.id;
        const matches = await prisma.match.findMany({
            where: { tournamentId },
            include: {
                homeTeam: { include: { players: true } },
                awayTeam: { include: { players: true } },
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
