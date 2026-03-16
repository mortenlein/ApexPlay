import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { SUPPORTED_GAMES } from '@/lib/games';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor');
    const limit = parseInt(searchParams.get('limit') || '10');

    const tournaments = await prisma.tournament.findMany({
        take: limit,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined,
        select: {
            id: true,
            name: true,
            game: true,
            category: true,
            format: true,
            teamSize: true,
            createdAt: true,
            _count: {
                select: { teams: true, matches: true }
            }
        },
        orderBy: { createdAt: 'desc' },
    });

    const nextCursor = tournaments.length === limit ? tournaments[tournaments.length - 1].id : null;

    return NextResponse.json({
        tournaments,
        nextCursor,
    });
}

export async function POST(request: Request) {
    try {
        const data = await request.json();

        // Ensure defaults if not provided
        const game = data.game || 'CS2';
        const format = data.format || 'SINGLE_ELIMINATION';
        const teamSize = data.teamSize ? parseInt(data.teamSize) : 5;
        const bo3StartRound = data.bo3StartRound ? parseInt(data.bo3StartRound) : null;
        const bo5StartRound = data.bo5StartRound ? parseInt(data.bo5StartRound) : null;
        const hasThirdPlace = !!data.hasThirdPlace;

        // Auto-determine category from game metadata
        const gameMeta = SUPPORTED_GAMES.find(g => g.id === game);
        const category = gameMeta?.category || 'BRACKET';

        const tournament = await prisma.tournament.create({
            data: {
                name: data.name,
                game,
                category,
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
