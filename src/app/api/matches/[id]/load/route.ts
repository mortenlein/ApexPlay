import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendConsoleCommand, getServerInfo } from '@/lib/dathost';

/**
 * POST /api/matches/{id}/load
 * 
 * "Load Match" action — pushes the match config to the DatHost CS2 server.
 * 1. Validates match exists and has teams with SteamIDs
 * 2. Fetches server info from DatHost for IP/port
 * 3. Sends matchzy_loadmatch_url command to the server
 * 4. Stores server connection details on the match record
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
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

        // Check if integrations are enabled
        const enableDatHost = process.env.ENABLE_DATHOST === 'true';
        const enableMatchZy = process.env.ENABLE_MATCHZY === 'true';

        // Only CS2 supports DatHost/MatchZy in this implementation
        const isCs2 = match.tournament?.game === 'CS2';

        if (!isCs2 || !enableDatHost) {
            console.log(`[Load Match] Integrations disabled or not CS2. Skipping server orchestration.`);
            
            // Just mark as LIVE/PENDING manually for non-integrated games
            const updated = await prisma.match.update({
                where: { id: params.id },
                data: {
                    status: 'PENDING',
                },
                include: {
                    homeTeam: { include: { players: true } },
                    awayTeam: { include: { players: true } },
                }
            });

            return NextResponse.json({
                success: true,
                message: 'Match marked as pending. Manual score updates required for this game/configuration.',
                match: updated
            });
        }

        // --- Integrated Path (CS2 + ENABLE_DATHOST) ---

        // Check that at least some players have SteamIDs
        const homeSteamIds = match.homeTeam.players.filter(p => p.steamId).length;
        const awaySteamIds = match.awayTeam.players.filter(p => p.steamId).length;

        if (homeSteamIds === 0 && awaySteamIds === 0) {
            return NextResponse.json({ 
                error: 'No players have SteamIDs configured. Add SteamIDs to players before loading a match.' 
            }, { status: 400 });
        }

        // Build the config URL (use the request's host for the URL)
        const url = new URL(request.url);
        const configUrl = `${url.protocol}//${url.host}/api/matches/${params.id}/config`;

        console.log(`[Load Match] Config URL: ${configUrl}`);

        // Get server info from DatHost
        let serverIp = process.env.DATHOST_SERVER_IP || '';
        let serverPort = process.env.DATHOST_SERVER_PORT || '27015';
        let serverPassword = process.env.DATHOST_SERVER_PASSWORD || '';

        try {
            const serverInfo = await getServerInfo();
            serverIp = serverInfo.ip || serverIp;
            serverPort = String(serverInfo.ports?.game || serverInfo.game_port || serverPort);
        } catch (e) {
            console.warn('[Load Match] Could not fetch DatHost server info, using env fallback');
        }

        // Send the loadmatch command to the game server (if MatchZy enabled)
        if (enableMatchZy) {
            const result = await sendConsoleCommand(`matchzy_loadmatch_url "${configUrl}"`);
            if (!result.success) {
                return NextResponse.json({ 
                    error: `Failed to send command to server: ${result.error}` 
                }, { status: 502 });
            }
        }

        // Store server connection details on the match
        const updated = await prisma.match.update({
            where: { id: params.id },
            data: {
                serverIp,
                serverPort,
                serverPassword,
                status: 'PENDING',
            },
            include: {
                homeTeam: { include: { players: true } },
                awayTeam: { include: { players: true } },
            },
        });

        console.log(`[Load Match] Match ${params.id} loaded on server ${serverIp}:${serverPort}`);

        return NextResponse.json({
            success: true,
            serverIp,
            serverPort,
            connectUrl: `steam://connect/${serverIp}:${serverPort}${serverPassword ? '/' + serverPassword : ''}`,
            match: updated,
        });
    } catch (error: any) {
        console.error('[Load Match] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
