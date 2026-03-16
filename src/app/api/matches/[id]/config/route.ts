import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMapPool } from '@/lib/games';

/**
 * GET /api/matches/{id}/config
 * 
 * Serves a MatchZy-compatible JSON match config.
 * The CS2 server pulls this via: matchzy_loadmatch_url "https://host/api/matches/{id}/config"
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
    try {
        const match = await prisma.match.findUnique({
            where: { id: params.id },
            include: {
                homeTeam: { include: { players: true } },
                awayTeam: { include: { players: true } },
                tournament: true,
            },
        });

        if (!match) {
            return NextResponse.json({ error: 'Match not found' }, { status: 404 });
        }

        // Build players object: { "steamid64": "PlayerName" }
        const team1Players: Record<string, string> = {};
        match.homeTeam?.players?.forEach((p) => {
            if (p.steamId) {
                team1Players[p.steamId] = p.name;
            }
        });

        const team2Players: Record<string, string> = {};
        match.awayTeam?.players?.forEach((p) => {
            if (p.steamId) {
                team2Players[p.steamId] = p.name;
            }
        });

        // Determine map list from existing mapScores or use default
        const mapPool = getMapPool(match.tournament?.teamSize || 5);
        let mapList = ['de_dust2']; // fallback
        
        try {
            const mapScores = typeof match.mapScores === 'string' 
                ? JSON.parse(match.mapScores) 
                : (match.mapScores || []);
            
            const configuredMaps = mapScores
                .map((m: any) => m.map)
                .filter((m: string) => m && m.length > 0);
            
            if (configuredMaps.length > 0) {
                mapList = configuredMaps;
            } else if (mapPool.length > 0) {
                // Default to first map from the game's pool
                mapList = [mapPool[0]?.shortName || 'de_dust2'];
            }
        } catch {}

        const config = {
            matchid: match.id,
            num_maps: match.bestOf,
            maplist: mapList.length >= match.bestOf 
                ? mapList.slice(0, match.bestOf) 
                : [...mapList, ...Array(match.bestOf - mapList.length).fill(mapList[0] || 'de_dust2')],
            skip_veto: true,
            team1: {
                name: match.homeTeam?.name || 'Team 1',
                players: team1Players,
            },
            team2: {
                name: match.awayTeam?.name || 'Team 2',
                players: team2Players,
            },
        };

        return NextResponse.json(config);
    } catch (error: any) {
        console.error('[Match Config] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
