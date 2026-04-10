import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { SUPPORTED_GAMES } from '@/lib/games';
import { requireAdminApi } from '@/lib/route-auth';
import { buildAdminActorLabel, recordAudit } from '@/lib/audit';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor');
    const limitParam = searchParams.get('limit') || '10';
    const fetchAll = limitParam === 'all';
    const limit = fetchAll ? undefined : parseInt(limitParam, 10);

    const tournaments = await prisma.tournament.findMany({
        take: limit,
        skip: cursor ? 1 : 0,
        cursor: cursor && !fetchAll ? { id: cursor } : undefined,
        select: {
            id: true,
            name: true,
            game: true,
            category: true,
            format: true,
            teamSize: true,
            createdAt: true,
            updatedAt: true,
            rosterLocked: true,
            steamSignupEnabled: true,
            _count: {
                select: { teams: true, matches: true }
            }
        },
        orderBy: { createdAt: 'desc' },
    });

    const nextCursor = !fetchAll && limit && tournaments.length === limit ? tournaments[tournaments.length - 1].id : null;

    return NextResponse.json({
        tournaments,
        nextCursor,
    });
}

export async function POST(request: Request) {
    const unauthorized = await requireAdminApi();
    if (unauthorized) return unauthorized;

    try {
        const data = await request.json();
        const name = typeof data.name === 'string' ? data.name.trim() : '';
        if (!name) {
            return NextResponse.json({ error: 'Tournament name is required' }, { status: 400 });
        }

        const game = typeof data.game === 'string' ? data.game : 'CS2';
        const format = typeof data.format === 'string' ? data.format : 'SINGLE_ELIMINATION';
        const teamSize = Number.parseInt(String(data.teamSize ?? '5'), 10);
        const bo3StartRound = data.bo3StartRound ? Number.parseInt(String(data.bo3StartRound), 10) : null;
        const bo5StartRound = data.bo5StartRound ? Number.parseInt(String(data.bo5StartRound), 10) : null;
        const hasThirdPlace = Boolean(data.hasThirdPlace);
        const gameMeta = SUPPORTED_GAMES.find(g => g.id === game);

        if (!gameMeta) {
            return NextResponse.json({ error: 'Unsupported game' }, { status: 400 });
        }

        if (!gameMeta.teamSize.includes(teamSize)) {
            return NextResponse.json({ error: 'Unsupported team size for this game' }, { status: 400 });
        }

        const category = gameMeta?.category || 'BRACKET';

        const tournament = await prisma.tournament.create({
            data: {
                name,
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

        await recordAudit({
            action: 'tournament.created',
            entityType: 'tournament',
            entityId: tournament.id,
            tournamentId: tournament.id,
            summary: `Created tournament ${tournament.name}`,
            actor: buildAdminActorLabel(),
            metadata: {
                game: tournament.game,
                format: tournament.format,
                teamSize: tournament.teamSize,
            },
        });

        return NextResponse.json(tournament);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
