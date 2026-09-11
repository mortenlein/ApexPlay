import prisma from '@/lib/prisma';
import { eventBus } from '@/lib/eventBus';
import { isStaffAuthenticated } from '@/lib/route-auth';

// Reads the session to decide whether server credentials are streamed; never prerender.
export const dynamic = 'force-dynamic';

/**
 * Strips the staff-only fields from a match payload: the game server endpoint/password and
 * player steamIds. Applied to both the DB-poll payloads and the eventBus payloads (which carry
 * full Prisma rows straight from the mutation routes).
 */
function toPublicMatch(match: any) {
    if (!match || typeof match !== 'object') {
        return match;
    }

    const publicMatch: Record<string, any> = { ...match };
    delete publicMatch.serverIp;
    delete publicMatch.serverPort;
    delete publicMatch.serverPassword;

    for (const side of ['homeTeam', 'awayTeam'] as const) {
        const team = publicMatch[side];
        if (team && Array.isArray(team.players)) {
            publicMatch[side] = {
                ...team,
                players: team.players.map((player: any) => {
                    const publicPlayer = { ...player };
                    delete publicPlayer.steamId;
                    return publicPlayer;
                }),
            };
        }
    }

    return publicMatch;
}

function toPublicPayload(payload: any) {
    if (!payload || typeof payload !== 'object' || !payload.match) {
        return payload;
    }

    return { ...payload, match: toPublicMatch(payload.match) };
}

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
            resultType: true,
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
                        select: { id: true, name: true, nickname: true, seating: true, steamId: true, isOnline: true, checkedInAt: true }
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
                        select: { id: true, name: true, nickname: true, seating: true, steamId: true, isOnline: true, checkedInAt: true }
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
export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const tournamentId = params.id;
    // Resolved once at connection time; the stream itself has no request context.
    const isStaff = await isStaffAuthenticated();

    const stream = new ReadableStream({
        start(controller) {
            const encoder = new TextEncoder();
            const lastPayloads = new Map<string, string>();

            const enqueuePayload = (payload: any) => {
                try {
                    const safePayload = isStaff ? payload : toPublicPayload(payload);
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(safePayload)}\n\n`));
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
