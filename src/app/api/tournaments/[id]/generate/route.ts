import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { generateSingleElimination } from '@/lib/bracket-utils';

export async function POST(request: Request, { params }: { params: { id: string } }) {
    try {
        const tournamentId = params.id;

        const tournament = await prisma.tournament.findUnique({
            where: { id: tournamentId },
            include: { teams: true },
        });

        if (!tournament) return NextResponse.json({ error: 'Not found' }, { status: 404 });

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

        return NextResponse.json({ success: true, count: createdMatches.length });
    } catch (error: any) {
        console.error('Bracket Generation Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
