import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request, { params }: { params: { id: string } }) {
    const teams = await prisma.team.findMany({
        where: { tournamentId: params.id },
        include: { players: true },
        orderBy: { seed: 'asc' },
    });
    return NextResponse.json(teams);
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
    try {
        const { name, logoUrl, seed, players } = await request.json();

        // Generate an initial logo if missing
        let finalLogoUrl = logoUrl;
        if (!finalLogoUrl || finalLogoUrl.trim() === '') {
            finalLogoUrl = `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name)}`;
        }

        const team = await prisma.team.create({
            data: {
                name,
                logoUrl: finalLogoUrl,
                seed: seed ? parseInt(seed) : null,
                tournamentId: params.id,
                players: {
                    create: Array.isArray(players) ? players.map((p: any) => ({ name: p.name, seating: p.seating || null })) : []
                }
            },
        });
        return NextResponse.json(team);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
