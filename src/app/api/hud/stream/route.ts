import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { eventBus } from '@/lib/eventBus';

/**
 * MASTER HUD STREAM
 * This endpoint automatically "hunts" for the most active match on the platform
 * and streams its telemetry. This allows the HUD to work without a matchId/tournamentId.
 */
export async function GET(request: NextRequest) {
    const responseStream = new TransformStream();
    const writer = responseStream.writable.getWriter();
    const encoder = new TextEncoder();

    const enqueuePayload = (data: any) => {
        writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)).catch(() => {});
    };

    // 1. Initial Discovery: Find the "Best" match to show right now
    const getActiveMatchId = async () => {
        const bestMatch = await prisma.match.findFirst({
            where: {
                OR: [
                    { status: 'LIVE' },
                    { status: 'IN_PROGRESS' },
                ]
            },
            orderBy: { updatedAt: 'desc' },
            select: { id: true }
        }) || await prisma.match.findFirst({
            orderBy: { updatedAt: 'desc' },
            select: { id: true }
        });

        return bestMatch?.id;
    };

    const initialMatchId = await getActiveMatchId();
    let currentMatchId = initialMatchId;

    // 2. Fetch logic for the specific match
    const getMatchPayload = async (id: string) => {
        return prisma.match.findUnique({
            where: { id },
            include: {
                homeTeam: { include: { players: { select: { id: true, name: true, nickname: true, seating: true, steamId: true, isOnline: true } } } },
                awayTeam: { include: { players: { select: { id: true, name: true, nickname: true, seating: true, steamId: true, isOnline: true } } } },
            }
        });
    };

    // 3. Listener for EventBus
    const onTelemetry = (data: any) => {
        // Forward EVERYTHING to the HUD. The HUD will handle the state management.
        // We also update our currentMatchId tracker so we can keep the feed stable if needed.
        if (data.matchId) {
            currentMatchId = data.matchId;
        }
        enqueuePayload(data);
    };

    eventBus.on('telemetry', onTelemetry);

    // Initial push
    if (initialMatchId) {
        const m = await getMatchPayload(initialMatchId);
        if (m) enqueuePayload({ matchId: initialMatchId, match: m });
    } else {
        enqueuePayload({ status: 'searching' });
    }

    // Ping / Keep-alive
    const interval = setInterval(() => {
        enqueuePayload({ type: 'ping', ts: Date.now() });
    }, 15000);

    request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        eventBus.off('telemetry', onTelemetry);
        writer.close().catch(() => {});
    });

    return new Response(responseStream.readable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
        },
    });
}
