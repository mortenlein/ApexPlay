import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { resolveSteamId } from '@/lib/steam';

export async function GET(request: Request, { params }: { params: { id: string } }) {
    const teams = await prisma.team.findMany({
        where: { tournamentId: params.id },
        select: {
            id: true,
            name: true,
            logoUrl: true,
            seed: true,
            players: {
                select: {
                    id: true,
                    name: true,
                    nickname: true,
                    countryCode: true,
                    seating: true,
                    steamId: true
                }
            }
        },
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

        // Resolve SteamIDs for all players
        const resolvedPlayers = await Promise.all(
            Array.isArray(players) ? players.map(async (p: any) => ({
                name: p.name,
                nickname: p.nickname || null,
                countryCode: p.countryCode || null,
                seating: p.seating || null,
                steamId: p.steamId ? await resolveSteamId(p.steamId) : null
            })) : []
        );

        const team = await prisma.team.create({
            data: {
                name,
                logoUrl: finalLogoUrl,
                seed: seed ? parseInt(seed) : null,
                tournamentId: params.id,
                players: {
                    create: resolvedPlayers
                }
            },
        });
        return NextResponse.json(team);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
