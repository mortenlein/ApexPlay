import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { eventBus } from '@/lib/eventBus';

/**
 * MatchZy Webhook Receiver
 * 
 * Handles POST events from the MatchZy CS2 plugin.
 * Auth: validates Authorization header against MATCHZY_WEBHOOK_KEY.
 * 
 * MatchZy config:
 *   matchzy_remote_log_url "https://your-domain.com/api/webhooks/matchzy"
 *   matchzy_remote_log_header_key "Authorization"
 *   matchzy_remote_log_header_value "Bearer <your-key>"
 */

export async function POST(request: Request) {
    // --- Auth Check ---
    const webhookKey = process.env.MATCHZY_WEBHOOK_KEY;
    if (webhookKey) {
        const authHeader = request.headers.get('Authorization');
        if (authHeader !== `Bearer ${webhookKey}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    try {
        const payload = await request.json();
        const eventType = payload.event;

        // Full payload logging for debugging via ngrok
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`[MatchZy] Event: ${eventType}`);
        console.log(`[MatchZy] Payload:`, JSON.stringify(payload, null, 2));
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

        switch (eventType) {
            case 'series_start':
                await handleSeriesStart(payload);
                break;
            case 'going_live':
                await handleGoingLive(payload);
                break;
            case 'round_end':
                await handleRoundEnd(payload);
                break;
            case 'map_result':
                await handleMapResult(payload);
                break;
            case 'series_end':
                await handleSeriesEnd(payload);
                break;
            case 'player_connect':
                await handlePlayerConnect(payload, true);
                break;
            case 'player_disconnect':
                await handlePlayerConnect(payload, false);
                break;
            default:
                // Discard unknown events silently (MatchZy sends many event types)
                break;
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[MatchZy Webhook] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// --- Match Resolution ---

async function resolveMatch(payload: any) {
    // Strategy 1: Try matchid as ApexPlay UUID
    if (payload.matchid) {
        const matchId = String(payload.matchid);
        const match = await prisma.match.findUnique({
            where: { id: matchId },
            include: { homeTeam: true, awayTeam: true },
        });
        if (match) return match;
    }

    // Strategy 2: Team-name matching — find a PENDING or IN_PROGRESS match
    const team1Name = payload.team1?.name;
    const team2Name = payload.team2?.name;

    if (!team1Name && !team2Name) return null;

    const matches = await prisma.match.findMany({
        where: {
            status: { in: ['PENDING', 'IN_PROGRESS', 'LIVE'] },
        },
        include: { homeTeam: true, awayTeam: true },
    });

    // Find match where team names match (in either order)
    return matches.find((m) => {
        const homeName = m.homeTeam?.name?.toLowerCase();
        const awayName = m.awayTeam?.name?.toLowerCase();
        const t1 = team1Name?.toLowerCase();
        const t2 = team2Name?.toLowerCase();

        return (
            (homeName === t1 && awayName === t2) ||
            (homeName === t2 && awayName === t1)
        );
    }) || null;
}

/**
 * Determine which MatchZy team (team1/team2) maps to homeTeam/awayTeam.
 * Returns { homeKey, awayKey } where values are 'team1' or 'team2'.
 */
function resolveTeamMapping(match: any, payload: any): { homeKey: string; awayKey: string } {
    const homeName = match.homeTeam?.name?.toLowerCase();
    const t1Name = payload.team1?.name?.toLowerCase();

    if (homeName === t1Name) {
        return { homeKey: 'team1', awayKey: 'team2' };
    }
    return { homeKey: 'team2', awayKey: 'team1' };
}

// --- Event Handlers ---

async function handleSeriesStart(payload: any) {
    const match = await resolveMatch(payload);
    if (!match) {
        console.warn('[MatchZy] series_start: Could not resolve match');
        return;
    }

    const updated = await prisma.match.update({
        where: { id: match.id },
        data: { status: 'LIVE' },
        include: { homeTeam: { include: { players: true } }, awayTeam: { include: { players: true } } },
    });

    broadcastUpdate(updated);
}

async function handleGoingLive(payload: any) {
    const match = await resolveMatch(payload);
    if (!match) {
        console.warn('[MatchZy] going_live: Could not resolve match');
        return;
    }

    if (match.status !== 'LIVE') {
        const updated = await prisma.match.update({
            where: { id: match.id },
            data: { status: 'LIVE' },
            include: { homeTeam: { include: { players: true } }, awayTeam: { include: { players: true } } },
        });
        broadcastUpdate(updated);
    }
}

async function handleRoundEnd(payload: any) {
    const match = await resolveMatch(payload);
    if (!match) {
        console.warn('[MatchZy] round_end: Could not resolve match');
        return;
    }

    const { homeKey, awayKey } = resolveTeamMapping(match, payload);
    const homeRoundScore = payload[homeKey]?.score ?? 0;
    const awayRoundScore = payload[awayKey]?.score ?? 0;

    // Parse existing mapScores to update the current map's round score
    const existingMapScores = typeof match.mapScores === 'string'
        ? JSON.parse(match.mapScores)
        : (match.mapScores || []);

    const mapNumber = payload.map_number ?? 0;

    // Ensure we have a slot for this map
    while (existingMapScores.length <= mapNumber) {
        existingMapScores.push({ map: '', home: 0, away: 0 });
    }
    existingMapScores[mapNumber].home = homeRoundScore;
    existingMapScores[mapNumber].away = awayRoundScore;

    const updated = await prisma.match.update({
        where: { id: match.id },
        data: {
            status: 'LIVE',
            mapScores: JSON.stringify(existingMapScores),
        },
        include: { homeTeam: { include: { players: true } }, awayTeam: { include: { players: true } } },
    });

    broadcastUpdate(updated);
}

async function handleMapResult(payload: any) {
    const match = await resolveMatch(payload);
    if (!match) {
        console.warn('[MatchZy] map_result: Could not resolve match');
        return;
    }

    const { homeKey, awayKey } = resolveTeamMapping(match, payload);

    // Update series scores from the team stats
    const homeSeriesScore = payload[homeKey]?.series_score ?? match.homeScore;
    const awaySeriesScore = payload[awayKey]?.series_score ?? match.awayScore;

    // Update map score with final result
    const existingMapScores = typeof match.mapScores === 'string'
        ? JSON.parse(match.mapScores)
        : (match.mapScores || []);

    const mapNumber = payload.map_number ?? 0;
    while (existingMapScores.length <= mapNumber) {
        existingMapScores.push({ map: '', home: 0, away: 0 });
    }
    existingMapScores[mapNumber].home = payload[homeKey]?.score ?? existingMapScores[mapNumber].home;
    existingMapScores[mapNumber].away = payload[awayKey]?.score ?? existingMapScores[mapNumber].away;

    const updated = await prisma.match.update({
        where: { id: match.id },
        data: {
            homeScore: homeSeriesScore,
            awayScore: awaySeriesScore,
            mapScores: JSON.stringify(existingMapScores),
        },
        include: { homeTeam: { include: { players: true } }, awayTeam: { include: { players: true } } },
    });

    broadcastUpdate(updated);
}

async function handleSeriesEnd(payload: any) {
    const match = await resolveMatch(payload);
    if (!match) {
        console.warn('[MatchZy] series_end: Could not resolve match');
        return;
    }

    const { homeKey, awayKey } = resolveTeamMapping(match, payload);
    const homeSeriesScore = payload[`${homeKey}_series_score`] ?? match.homeScore;
    const awaySeriesScore = payload[`${awayKey}_series_score`] ?? match.awayScore;

    // Determine winner
    let winnerId = null;
    let loserId = null;
    const winnerTeam = payload.winner?.team; // 'team1' or 'team2'

    if (winnerTeam) {
        if (winnerTeam === homeKey) {
            winnerId = match.homeTeamId;
            loserId = match.awayTeamId;
        } else {
            winnerId = match.awayTeamId;
            loserId = match.homeTeamId;
        }
    } else if (homeSeriesScore > awaySeriesScore) {
        winnerId = match.homeTeamId;
        loserId = match.awayTeamId;
    } else if (awaySeriesScore > homeSeriesScore) {
        winnerId = match.awayTeamId;
        loserId = match.homeTeamId;
    }

    const updated = await prisma.match.update({
        where: { id: match.id },
        data: {
            homeScore: homeSeriesScore,
            awayScore: awaySeriesScore,
            winnerId,
            status: 'COMPLETED',
        },
        include: { homeTeam: { include: { players: true } }, awayTeam: { include: { players: true } } },
    });

    // Auto-advance winner to next match
    if (winnerId && match.nextMatchId) {
        const isNextHome = match.matchOrder % 2 === 0;
        await prisma.match.update({
            where: { id: match.nextMatchId },
            data: {
                ...(isNextHome ? { homeTeamId: winnerId } : { awayTeamId: winnerId }),
            },
        });

        // Broadcast the next match update too
        const nextMatch = await prisma.match.findUnique({
            where: { id: match.nextMatchId },
            include: { homeTeam: { include: { players: true } }, awayTeam: { include: { players: true } } },
        });
        if (nextMatch) broadcastUpdate(nextMatch);
    }

    // Auto-advance loser (3rd place / losers bracket)
    if (loserId && match.loserNextMatchId) {
        const isNextHome = match.matchOrder % 2 === 0;
        await prisma.match.update({
            where: { id: match.loserNextMatchId },
            data: {
                ...(isNextHome ? { homeTeamId: loserId } : { awayTeamId: loserId }),
            },
        });

        const loserNextMatch = await prisma.match.findUnique({
            where: { id: match.loserNextMatchId },
            include: { homeTeam: { include: { players: true } }, awayTeam: { include: { players: true } } },
        });
        if (loserNextMatch) broadcastUpdate(loserNextMatch);
    }

    broadcastUpdate(updated);
}

// --- Broadcasting ---

function broadcastUpdate(match: any) {
    const data = {
        matchId: match.id,
        tournamentId: match.tournamentId,
        match,
    };
    eventBus.emit(`match:${match.id}`, data);
    eventBus.emit(`tournament:${match.tournamentId}`, data);
}

// --- Player Connection Tracking ---

async function handlePlayerConnect(payload: any, isOnline: boolean) {
    const steamId = payload.player?.steamid;
    if (!steamId) {
        console.warn(`[MatchZy] player_${isOnline ? 'connect' : 'disconnect'}: No steamid in payload`);
        return;
    }

    console.log(`[MatchZy] Player ${isOnline ? 'connected' : 'disconnected'}: ${payload.player?.name} (${steamId})`);

    // Update all players with this steamId
    const result = await prisma.player.updateMany({
        where: { steamId },
        data: { isOnline },
    });

    if (result.count > 0) {
        // Find the match to broadcast the update
        const match = await resolveMatch(payload);
        if (match) {
            const fullMatch = await prisma.match.findUnique({
                where: { id: match.id },
                include: { homeTeam: { include: { players: true } }, awayTeam: { include: { players: true } } },
            });
            if (fullMatch) broadcastUpdate(fullMatch);
        }
    }
}
