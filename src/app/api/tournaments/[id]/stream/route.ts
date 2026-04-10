import prisma from '@/lib/prisma';
import { eventBus } from '@/lib/eventBus';

async function getTournamentMatches(tournamentId: string) {
    return prisma.match.findMany({
        where: { tournamentId },
        select: {
            id: true,
            round: true,
            matchOrder: true,
            status: true,
            bracketType: true,
            bestOf: true,
            scoreLimit: true,
            homeScore: true,
            awayScore: true,
            winnerId: true,
            nextMatchId: true,
            loserNextMatchId: true,
            homeTeamId: true,
            awayTeamId: true,
            mapScores: true,
            serverIp: true,
            serverPort: true,
            serverPassword: true,
            homeTeam: {
                select: {
                    id: true,
                    name: true,
                    logoUrl: true,
                    seed: true,
                    players: {
                        select: { id: true, name: true, nickname: true, seating: true, steamId: true, isOnline: true }
                    }
                }
            },
            awayTeam: {
                select: {
                    id: true,
                    name: true,
                    logoUrl: true,
                    seed: true,
                    players: {
                        select: { id: true, name: true, nickname: true, seating: true, steamId: true, isOnline: true }
                    }
                }
            }
        },
        orderBy: [
            { round: 'asc' },
            { matchOrder: 'asc' },
        ],
    });
}

/**
 * SSE endpoint: GET /api/tournaments/{id}/stream
 * Streams all match updates for a tournament in real-time.
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
    const tournamentId = params.id;

    const stream = new ReadableStream({
        start(controller) {
            const encoder = new TextEncoder();
            const lastPayloads = new Map<string, string>();

            const enqueuePayload = (payload: any) => {
                try {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
                } catch {
                    // Client disconnected
                }
            };

            const syncFromDatabase = async () => {
                try {
                    const matches = await getTournamentMatches(tournamentId);
                    for (const match of matches) {
                        const serialized = JSON.stringify(match);
                        if (lastPayloads.get(match.id) !== serialized) {
                            lastPayloads.set(match.id, serialized);
                            enqueuePayload({
                                matchId: match.id,
                                tournamentId,
                                match,
                            });
                        }
                    }
                } catch (error) {
                    console.error(`[TournamentStream] Poll error for ${tournamentId}:`, error);
                }
            };

            // Send initial keepalive
            controller.enqueue(encoder.encode(`: connected to tournament ${tournamentId}\n\n`));

            const listener = (data: any) => {
                try {
                    if (data?.matchId && data?.match) {
                        lastPayloads.set(data.matchId, JSON.stringify(data.match));
                    }
                    enqueuePayload(data);
                } catch {
                    // Client disconnected
                }
            };

            eventBus.on(`tournament:${tournamentId}`, listener);
            void syncFromDatabase();

            // Keepalive every 30s to prevent proxy/browser timeout
            const keepalive = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(`: keepalive\n\n`));
                } catch {
                    clearInterval(keepalive);
                }
            }, 30000);

            const poller = setInterval(() => {
                void syncFromDatabase();
            }, 3000);

            // Cleanup on disconnect
            request.signal.addEventListener('abort', () => {
                eventBus.off(`tournament:${tournamentId}`, listener);
                clearInterval(keepalive);
                clearInterval(poller);
                try { controller.close(); } catch {}
            });
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no', // Disable nginx buffering
        },
    });
}
