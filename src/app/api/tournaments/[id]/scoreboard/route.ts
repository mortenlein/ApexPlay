import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const scoreboard = await prisma.scoreboardEntry.findMany({
            where: { tournamentId: params.id },
            include: { team: true },
            orderBy: { points: 'desc' }
        });
        return NextResponse.json(scoreboard);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const { teamId, kills, placement, points } = await request.json();

        const entry = await prisma.scoreboardEntry.upsert({
            where: {
                tournamentId_teamId: {
                    tournamentId: params.id,
                    teamId: teamId
                }
            },
            update: {
                kills,
                placement,
                points
            },
            create: {
                tournamentId: params.id,
                teamId,
                kills,
                placement,
                points
            }
        });

        return NextResponse.json(entry);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
