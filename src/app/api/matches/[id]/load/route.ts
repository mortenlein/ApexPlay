import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireStaffApi } from '@/lib/route-auth';
import { eventBus } from '@/lib/eventBus';
import { buildActorLabel, recordAudit } from '@/lib/audit';
import { notifyMatchReady } from '@/lib/notify';

/**
 * POST /api/matches/{id}/load
 *
 * "Start Match" — calls the match (status READY), broadcasts to live views, and notifies both
 * rosters on every channel: web push to each registered player, an in-app NotificationLog entry
 * and the Discord announce (all of that is notifyMatchReady, so this route must not announce
 * separately or Discord gets the same match twice). Staff, because marshals call matches on the
 * floor. Scores are updated by staff, or by inbound CS2/EON telemetry on /api/webhooks/cs2.
 */
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const unauthorized = await requireStaffApi();
    if (unauthorized) return unauthorized;

    try {
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
            data: { status: 'READY' },
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

        // Push + in-app log + Discord announce, all best-effort inside notifyMatchReady.
        await notifyMatchReady(updated.id, 'READY');

        await recordAudit({
            action: 'match.loaded',
            entityType: 'match',
            entityId: updated.id,
            tournamentId: updated.tournamentId,
            summary: `Called match ${updated.id.slice(0, 8)} — both teams notified`,
            actor: await buildActorLabel(),
        });

        return NextResponse.json({
            success: true,
            message: 'Match called. Both teams were notified — update scores as it plays out.',
            match: updated,
        });
    } catch (error: any) {
        console.error('[Load Match] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
