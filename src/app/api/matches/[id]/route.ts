import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { announceResult, announceMatch } from '@/lib/discord';
import { requireAdminApi } from '@/lib/route-auth';
import { eventBus } from '@/lib/eventBus';
import { buildAdminActorLabel, recordAudit } from '@/lib/audit';
import { conflictResponse, hasTimestampConflict, normalizeExpectedUpdatedAt } from '@/lib/mutation-guards';

export async function POST(request: Request, { params }: { params: { id: string } }) {
    const unauthorized = await requireAdminApi();
    if (unauthorized) return unauthorized;

    try {
        const body = await request.json();
        const { homeScore, awayScore, mapScores, bestOf, scoreLimit, status: manualStatus } = body;

        const match = await prisma.match.findUnique({
            where: { id: params.id },
            include: { 
                homeTeam: true, 
                awayTeam: true,
                tournament: true
            }
        });

        if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

        const expectedUpdatedAt = normalizeExpectedUpdatedAt(body.expectedUpdatedAt);
        if (hasTimestampConflict(match.updatedAt, expectedUpdatedAt)) {
            return conflictResponse();
        }

        let winnerId = null;
        let loserId = null;
        let status = manualStatus || match.status || 'READY';

        // Auto-determine completion if scores reach limit (if not manually set)
        const effectiveScoreLimit = scoreLimit || match.scoreLimit || 2; // Default to 2 for BO3
        if (status !== 'COMPLETED') {
            if (homeScore >= effectiveScoreLimit) {
                winnerId = match.homeTeamId;
                loserId = match.awayTeamId;
                status = 'COMPLETED';
            } else if (awayScore >= effectiveScoreLimit) {
                winnerId = match.awayTeamId;
                loserId = match.homeTeamId;
                status = 'COMPLETED';
            }
        } else {
            // Manually marked as completed, find winner by scores
            if (homeScore > awayScore) {
                winnerId = match.homeTeamId;
                loserId = match.awayTeamId;
            } else if (awayScore > homeScore) {
                winnerId = match.awayTeamId;
                loserId = match.homeTeamId;
            }
        }

        // Update current match
        const updatedMatch = await prisma.match.update({
            where: { id: params.id },
            data: {
                ...(homeScore !== undefined && { homeScore }),
                ...(awayScore !== undefined && { awayScore }),
                ...(mapScores !== undefined && { mapScores: typeof mapScores === 'string' ? mapScores : JSON.stringify(mapScores) }),
                ...(bestOf !== undefined && { bestOf }),
                ...(scoreLimit !== undefined && { scoreLimit }),
                winnerId,
                status
            }
        });

        const broadcastMatch = async (matchId: string) => {
            const fullMatch = await prisma.match.findUnique({
                where: { id: matchId },
                include: {
                    homeTeam: { include: { players: true } },
                    awayTeam: { include: { players: true } },
                },
            });

            if (!fullMatch) {
                return;
            }

            const payload = {
                matchId: fullMatch.id,
                tournamentId: fullMatch.tournamentId,
                match: fullMatch,
            };
            eventBus.emit('telemetry', payload);
            eventBus.emit(`match:${fullMatch.id}`, payload);
            eventBus.emit(`tournament:${fullMatch.tournamentId}`, payload);
        };

        // Announce result to Discord if just completed
        if (status === 'COMPLETED' && match.status !== 'COMPLETED' && match.homeTeam && match.awayTeam) {
            await announceResult({
                homeTeam: match.homeTeam.name,
                awayTeam: match.awayTeam.name,
                homeScore,
                awayScore,
                tournamentName: match.tournament.name,
                tournamentId: match.tournamentId,
                matchUrl: `${process.env.NEXTAUTH_URL}/tournaments/${match.tournamentId}`,
                game: match.tournament.game
            });
        }

        const wasJustCompleted = status === 'COMPLETED' && match.status !== 'COMPLETED';

        const handleAdvance = async (nextMatchId: string, advancedTeamId: string, isNextHome: boolean) => {
            const existingNextMatch = await prisma.match.findUnique({
                where: { id: nextMatchId },
                select: {
                    homeTeamId: true,
                    awayTeamId: true,
                },
            });

            if (!existingNextMatch) {
                return null;
            }

            const nextMatch = await prisma.match.update({
                where: { id: nextMatchId },
                data: {
                    ...(isNextHome ? { homeTeamId: advancedTeamId } : { awayTeamId: advancedTeamId })
                },
                include: { homeTeam: true, awayTeam: true, tournament: true }
            });

            // If match now has both teams, announce it
            if (nextMatch.homeTeam && nextMatch.awayTeam) {
                await announceMatch({
                    homeTeam: nextMatch.homeTeam.name,
                    awayTeam: nextMatch.awayTeam.name,
                    round: nextMatch.round,
                    tournamentName: nextMatch.tournament.name,
                    tournamentId: nextMatch.tournamentId,
                    matchUrl: `${process.env.NEXTAUTH_URL}/tournaments/${nextMatch.tournamentId}`,
                    game: nextMatch.tournament.game
                });
            }

            const payload = {
                matchId: nextMatch.id,
                tournamentId: nextMatch.tournamentId,
                match: nextMatch,
            };
            eventBus.emit('telemetry', payload);
            eventBus.emit(`match:${nextMatch.id}`, payload);
            eventBus.emit(`tournament:${nextMatch.tournamentId}`, payload);
        };

        if (wasJustCompleted && winnerId && match.nextMatchId) {
            const isNextHome = match.matchOrder % 2 === 0;
            await handleAdvance(match.nextMatchId, winnerId, isNextHome);
        }

        if (wasJustCompleted && loserId && match.loserNextMatchId) {
            const isNextHome = match.matchOrder % 2 === 0;
            await handleAdvance(match.loserNextMatchId, loserId, isNextHome);
        }

        await broadcastMatch(updatedMatch.id);

        await recordAudit({
            action: 'match.updated',
            entityType: 'match',
            entityId: updatedMatch.id,
            tournamentId: updatedMatch.tournamentId,
            summary: `Updated match ${updatedMatch.id.slice(0, 8)} to ${updatedMatch.homeScore}:${updatedMatch.awayScore} (${updatedMatch.status})`,
            actor: buildAdminActorLabel(),
            metadata: {
                homeScore: updatedMatch.homeScore,
                awayScore: updatedMatch.awayScore,
                status: updatedMatch.status,
            },
        });

        return NextResponse.json(updatedMatch);
    } catch (error: any) {
        console.error('Match Update Logic Failure:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
