import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
    const tournaments = await prisma.tournament.findMany({
        orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(tournaments);
}

export async function POST(request: Request) {
    try {
        const data = await request.json();

        // Ensure defaults if not provided
        const format = data.format || 'SINGLE_ELIMINATION';
        const teamSize = data.teamSize ? parseInt(data.teamSize) : 5;
        const bo3StartRound = data.bo3StartRound ? parseInt(data.bo3StartRound) : null;
        const bo5StartRound = data.bo5StartRound ? parseInt(data.bo5StartRound) : null;
        const hasThirdPlace = !!data.hasThirdPlace;

        const tournament = await prisma.tournament.create({
            data: {
                name: data.name,
                type: data.type || format,
                format,
                teamSize,
                bo3StartRound,
                bo5StartRound,
                hasThirdPlace
            },
        });
        return NextResponse.json(tournament);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
