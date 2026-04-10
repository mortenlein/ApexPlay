import prisma from '@/lib/prisma';
import { eventBus } from '@/lib/eventBus';

async function getMatchPayload(matchId: string) {
    return prisma.match.findUnique({
        where: { id: matchId },
        select: {
            id: true,
            tournamentId: true,
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
    });
}

/**
 * SSE endpoint: GET /api/matches/{id}/stream
 * Streams updates for a single match in real-time.
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
    const matchId = params.id;

    const stream = new ReadableStream({
        start(controller) {
            const encoder = new TextEncoder();
            let lastPayload = "";

            const enqueuePayload = (payload: any) => {
                try {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
                } catch {
                    // Client disconnected
                }
            };

            const syncFromDatabase = async () => {
                try {
                    const match = await getMatchPayload(matchId);
                    if (!match) {
                        return;
                    }

                    const serialized = JSON.stringify(match);
                    if (serialized !== lastPayload) {
                        lastPayload = serialized;
                        enqueuePayload({
                            matchId,
                            tournamentId: match.tournamentId,
                            match,
                        });
                    }
                } catch (error) {
                    console.error(`[MatchStream] Poll error for ${matchId}:`, error);
                }
            };

            controller.enqueue(encoder.encode(`: connected to match ${matchId}\n\n`));

            const listener = (data: any) => {
                try {
                    if (data?.match) {
                        lastPayload = JSON.stringify(data.match);
                    }
                    enqueuePayload(data);
                } catch {
                    // Client disconnected
                }
            };

            eventBus.on(`match:${matchId}`, listener);
            void syncFromDatabase();

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

            request.signal.addEventListener('abort', () => {
                eventBus.off(`match:${matchId}`, listener);
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
            'X-Accel-Buffering': 'no',
        },
    });
}
