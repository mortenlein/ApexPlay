import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { generateSingleElimination } from '@/lib/bracket-utils';
import { announceMatch } from '@/lib/discord';
import { requireAdminApi } from '@/lib/route-auth';
import { buildAdminActorLabel, recordAudit } from '@/lib/audit';
import { lockedResponse } from '@/lib/mutation-guards';

export async function POST(request: Request, { params }: { params: { id: string } }) {
    const unauthorized = await requireAdminApi();
    if (unauthorized) return unauthorized;

    try {
        const tournamentId = params.id;
        const body = await request.json().catch(() => ({}));

        const tournament = await prisma.tournament.findUnique({
            where: { id: tournamentId },
            include: { teams: true, _count: { select: { matches: true } } },
        });

        if (!tournament) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        if (tournament.rosterLocked && tournament._count.matches > 0 && !body.overrideLock) {
            return lockedResponse('Bracket changes are locked. Unlock roster edits in tournament settings before regenerating matches.');
        }

        const teams = tournament.teams;
        if (teams.length < 2) {
            return NextResponse.json({ error: 'Need at least 2 teams to generate a bracket' }, { status: 400 });
        }

        const options = {
            bo3StartRound: tournament.bo3StartRound,
            bo5StartRound: tournament.bo5StartRound,
            hasThirdPlace: tournament.hasThirdPlace,
        };

        // 2. Generate bracket structure
        const bracketMatches = generateSingleElimination(teams, options);

        // 3. Clear existing matches
        await prisma.match.deleteMany({
            where: { tournamentId },
        });

        // 4. Create matches in a transaction to ensure atomic updates
        const createdMatches = await prisma.$transaction(async (tx: any) => {
            const records = [];
            for (const m of bracketMatches) {
                const record = await tx.match.create({
                    data: {
                        tournamentId,
                        round: m.round,
                        matchOrder: m.matchOrder,
                        homeTeamId: m.homeTeamId,
                        awayTeamId: m.awayTeamId,
                        status: 'PENDING',
                        bestOf: m.bestOf,
                        scoreLimit: m.scoreLimit,
                        bracketType: m.bracketType,
                    },
                });
                records.push(record);
            }
            return records;
        });

        // 5. Link matches using nextMatchId and loserNextMatchId
        await prisma.$transaction(
            createdMatches.map((m: any) => {
                const template = bracketMatches.find(
                    (t: any) => t.round === m.round && t.matchOrder === m.matchOrder && t.bracketType === m.bracketType
                );

                if (!template) return prisma.match.update({ where: { id: m.id }, data: {} });

                const updateData: any = {};

                if (template.nextMatchRound !== null) {
                    const nextMatch = createdMatches.find(
                        (nm: any) => nm.round === template.nextMatchRound && nm.matchOrder === template.nextMatchOrder && nm.bracketType === 'WINNERS'
                    );
                    if (nextMatch) updateData.nextMatchId = nextMatch.id;
                }

                if (template.loserNextMatchRound !== null) {
                    // Find the 3rd place match (or losers bracket match)
                    const loserNextMatch = createdMatches.find(
                        (nm: any) => nm.round === template.loserNextMatchRound && nm.matchOrder === template.loserNextMatchOrder && (nm.bracketType === 'THIRD_PLACE' || nm.bracketType === 'LOSERS')
                    );
                    if (loserNextMatch) updateData.loserNextMatchId = loserNextMatch.id;
                }

                if (Object.keys(updateData).length > 0) {
                    return prisma.match.update({
                        where: { id: m.id },
                        data: updateData,
                    });
                }

                return prisma.match.update({ where: { id: m.id }, data: {} }); // No-op
            })
        );

        // 6. Announce initial matches that are already fixed (have both teams)
        const fixedMatches = await prisma.match.findMany({
            where: { 
                tournamentId,
                homeTeamId: { not: null },
                awayTeamId: { not: null }
            },
            include: { homeTeam: true, awayTeam: true, tournament: true }
        });

        for (const m of fixedMatches) {
            await announceMatch({
                homeTeam: m.homeTeam!.name,
                awayTeam: m.awayTeam!.name,
                round: m.round,
                tournamentName: m.tournament.name,
                tournamentId,
                matchUrl: `${process.env.NEXTAUTH_URL}/tournaments/${tournamentId}`
            });
        }

        await prisma.tournament.update({
            where: { id: tournamentId },
            data: { rosterLocked: true },
        });

        await recordAudit({
            action: 'bracket.generated',
            entityType: 'tournament',
            entityId: tournamentId,
            tournamentId,
            summary: `Generated ${createdMatches.length} matches for ${tournament.name}`,
            actor: buildAdminActorLabel(),
            metadata: {
                matchCount: createdMatches.length,
                teamCount: teams.length,
            },
        });

        return NextResponse.json({ success: true, count: createdMatches.length });
    } catch (error: any) {
        console.error('Bracket Generation Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
