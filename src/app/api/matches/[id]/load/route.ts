import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminApi } from '@/lib/route-auth';
import { eventBus } from '@/lib/eventBus';
import { announceMatch } from '@/lib/discord';
import { buildActorLabel, recordAudit } from '@/lib/audit';

/**
 * POST /api/matches/{id}/load
 *
 * "Load Match" — marks the match ready for players, broadcasts to live views, and announces
 * it (Discord + seating). Scores are updated by an organizer, or by inbound CS2/EON telemetry
 * on /api/webhooks/cs2. (The old DatHost/MatchZy server-orchestration path has been removed.)
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
    const unauthorized = await requireAdminApi();
    if (unauthorized) return unauthorized;

    try {
        const requestUrl = new URL(request.url);
        const match = await prisma.match.findUnique({
            where: { id: params.id },
            include: {
                tournament: true,
                homeTeam: { include: { players: true } },
                awayTeam: { include: { players: true } },
            },
        });

        if (!match) {
            return NextResponse.json({ error: 'Match not found' }, { status: 404 });
        }
        if (!match.homeTeam || !match.awayTeam) {
            return NextResponse.json({ error: 'Both teams must be assigned before loading a match' }, { status: 400 });
        }

        const updated = await prisma.match.update({
            where: { id: params.id },
            data: { status: 'WAITING_FOR_PLAYERS' },
            include: {
                homeTeam: { include: { players: true } },
                awayTeam: { include: { players: true } },
            },
        });

        const payload = {
            matchId: updated.id,
            tournamentId: updated.tournamentId,
            match: updated,
        };
        eventBus.emit(`match:${updated.id}`, payload);
        eventBus.emit(`tournament:${updated.tournamentId}`, payload);

        try {
            await announceMatch({
                homeTeam: updated.homeTeam?.name || 'TBD',
                awayTeam: updated.awayTeam?.name || 'TBD',
                homePlayers: (updated.homeTeam?.players || []).map((player) => `${player.nickname || player.name} (${player.seating || '?'})`).join(', '),
                awayPlayers: (updated.awayTeam?.players || []).map((player) => `${player.nickname || player.name} (${player.seating || '?'})`).join(', '),
                round: updated.round,
                tournamentName: match.tournament?.name || 'Tournament',
                tournamentId: updated.tournamentId,
                matchUrl: `${process.env.NEXTAUTH_URL || `${requestUrl.protocol}//${requestUrl.host}`}/tournaments/${updated.tournamentId}`,
                game: match.tournament?.game || 'CS2',
            });
        } catch (notificationError) {
            console.error('[Load Match] Failed to announce match start:', notificationError);
        }

        await recordAudit({
            action: 'match.loaded',
            entityType: 'match',
            entityId: updated.id,
            tournamentId: updated.tournamentId,
            summary: `Marked match ${updated.id.slice(0, 8)} waiting for players`,
            actor: await buildActorLabel(),
        });

        return NextResponse.json({
            success: true,
            message: 'Match is ready and waiting for players. Update scores as the match plays out.',
            match: updated,
        });
    } catch (error: any) {
        console.error('[Load Match] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
