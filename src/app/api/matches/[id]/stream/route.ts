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
export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const matchId = params.id;
    // Resolved once at connection time; the stream itself has no request context.
    const isStaff = await isStaffAuthenticated();

    const stream = new ReadableStream({
        start(controller) {
            const encoder = new TextEncoder();
            let lastPayload = "";

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
