import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request, { params }: { params: { id: string } }) {
    try {
        const tournament = await prisma.tournament.findUnique({
            where: { id: params.id },
            include: {
                _count: {
                    select: { teams: true, matches: true }
                }
            }
        });

        if (!tournament) {
            return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
        }

        return NextResponse.json(tournament);
    } catch (error: any) {
        console.error('Fetch tournament error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
