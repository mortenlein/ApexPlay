import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireStaffApi } from '@/lib/route-auth';
import { eventBus } from '@/lib/eventBus';
import { buildActorLabel, recordAudit } from '@/lib/audit';

// Mutates on a session-authenticated request; never prerender.
export const dynamic = 'force-dynamic';

/**
 * POST /api/players/{id}/checkin — "player is at their seat".
 *
 * Floor staff (admin or marshal) walk the venue and confirm players physically sat down at the
 * seat printed on the marshal board. That state has to be shared between marshals and survive a
 * reload, so it lives on the player row (`checkedInAt`) instead of local component state.
 *
 * Body: { checkedIn: boolean } — true stamps now(), false clears it.
 * Broadcasts `{ type: 'player:checkin', ... }` on the tournament channel so every open board
 * (marshal, control cockpit) updates over SSE without polling.
 */
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const unauthorized = await requireStaffApi();
    if (unauthorized) return unauthorized;

    try {
        const body = await request.json().catch(() => ({}));
        const { checkedIn } = body ?? {};

        if (typeof checkedIn !== 'boolean') {
            return NextResponse.json({ error: 'checkedIn must be a boolean' }, { status: 400 });
        }

        const player = await prisma.player.findUnique({
            where: { id: params.id },
            select: { id: true, name: true, nickname: true, seating: true, teamId: true, tournamentId: true },
        });

        if (!player) {
            return NextResponse.json({ error: 'Player not found' }, { status: 404 });
        }

        const updated = await prisma.player.update({
            where: { id: player.id },
            data: { checkedInAt: checkedIn ? new Date() : null },
            select: { id: true, name: true, nickname: true, seating: true, teamId: true, checkedInAt: true },
        });

        eventBus.emit(`tournament:${player.tournamentId}`, {
            type: 'player:checkin',
            playerId: updated.id,
            teamId: updated.teamId,
            tournamentId: player.tournamentId,
            checkedInAt: updated.checkedInAt,
        });

        const label = updated.nickname || updated.name;
        await recordAudit({
            action: checkedIn ? 'player.checkedIn' : 'player.checkinCleared',
            entityType: 'player',
            entityId: updated.id,
            tournamentId: player.tournamentId,
            summary: checkedIn
                ? `${label} confirmed at seat ${updated.seating || '—'}`
                : `${label} no longer marked at seat`,
            actor: await buildActorLabel(),
            metadata: { seating: updated.seating, checkedInAt: updated.checkedInAt },
        });

        return NextResponse.json({ success: true, player: updated });
    } catch (error: any) {
        console.error('[Player Checkin] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
