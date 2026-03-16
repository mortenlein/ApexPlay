export interface BracketMatch {
    round: number;
    matchOrder: number;
    homeTeamId: string | null;
    awayTeamId: string | null;
    nextMatchOrder: number | null;
    nextMatchRound: number | null;
    loserNextMatchRound: number | null;
    loserNextMatchOrder: number | null;
    bestOf: number;
    scoreLimit: number;
    bracketType: string;
}

interface GenerateOptions {
    bo3StartRound?: number | null;
    bo5StartRound?: number | null;
    hasThirdPlace?: boolean;
}

export function generateSingleElimination(
    teams: { id: string, seed: number | null }[],
    options: GenerateOptions = {}
): BracketMatch[] {
    const numTeams = teams.length;
    if (numTeams < 2) return [];

    const sortedTeams = [...teams].sort((a, b) => (a.seed || 999) - (b.seed || 999));
    const rounds = Math.ceil(Math.log2(numTeams));
    const numSlots = Math.pow(2, rounds);
    const matches: BracketMatch[] = [];

    // Helper for Best-Of logic
    const getFormat = (currentRound: number) => {
        // boXStartRound in DB is absolute round number: 1, 2, 3...
        // Rounds in logic: 1 is the first round, rounds is the final.
        
        const bo5Start = options.bo5StartRound;
        const bo3Start = options.bo3StartRound;

        if (bo5Start && bo5Start > 0 && currentRound >= bo5Start) return { bestOf: 5, limit: 3 };
        if (bo3Start && bo3Start > 0 && currentRound >= bo3Start) return { bestOf: 3, limit: 2 };
        return { bestOf: 1, limit: 1 };
    };

    // Create Main Bracket
    for (let r = 1; r <= rounds; r++) {
        const matchesInRound = Math.pow(2, rounds - r);
        const format = getFormat(r);

        for (let m = 0; m < matchesInRound; m++) {
            const isFinal = r === rounds;
            const nextRound = r + 1;
            const nextOrder = Math.floor(m / 2);

            let loserNextMatchRound = null;
            let loserNextMatchOrder = null;

            // Link semi-finals to 3rd place match if enabled
            if (options.hasThirdPlace && r === rounds - 1) {
                loserNextMatchRound = rounds; // Place 3rd place match in the final column logically
                loserNextMatchOrder = 1; // Final is order 0, Third Place is order 1
            }

            matches.push({
                round: r,
                matchOrder: m,
                homeTeamId: null,
                awayTeamId: null,
                nextMatchRound: isFinal ? null : nextRound,
                nextMatchOrder: isFinal ? null : nextOrder,
                loserNextMatchRound,
                loserNextMatchOrder,
                bestOf: format.bestOf,
                scoreLimit: format.limit,
                bracketType: 'WINNERS'
            });
        }
    }

    // Add Third Place Match explicitly
    if (options.hasThirdPlace && rounds >= 2) {
        const format = getFormat(rounds); // Use the final round's format or maybe semi's? Let's use final's format.
        matches.push({
            round: rounds,
            matchOrder: 1, // Final is order 0
            homeTeamId: null,
            awayTeamId: null,
            nextMatchRound: null,
            nextMatchOrder: null,
            loserNextMatchRound: null,
            loserNextMatchOrder: null,
            bestOf: format.bestOf,
            scoreLimit: format.limit,
            bracketType: 'THIRD_PLACE'
        });
    }

    // Seeding logic (standard meet-in-the-middle)
    // Actually standard single elimination seed pairs add up to numSlots + 1
    // Let's perform standard recursive seeding for correct Meet-in-the-middle bracket structures
    const generateSeeds = (slots: number): number[] => {
        if (slots === 1) return [1];
        if (slots === 2) return [1, 2];
        let current = [1, 2];
        for (let i = 2; i < Math.log2(slots) + 1; i++) {
            const nextSlots = Math.pow(2, i);
            const sum = nextSlots + 1;
            const nextArray = [];
            for (const s of current) {
                nextArray.push(s);
                nextArray.push(sum - s);
            }
            current = nextArray;
        }
        return current;
    };

    const seeds = generateSeeds(numSlots);
    const round1Matches = matches.filter(m => m.round === 1 && m.bracketType === 'WINNERS');

    for (let i = 0; i < numSlots / 2; i++) {
        const homeSeed = seeds[i * 2];
        const awaySeed = seeds[i * 2 + 1];

        // 0-indexed arrays
        const homeTeam = sortedTeams[homeSeed - 1];
        const awayTeam = sortedTeams[awaySeed - 1];

        const match = round1Matches.find(m => m.matchOrder === i);
        if (match) {
            match.homeTeamId = homeTeam ? homeTeam.id : null;
            match.awayTeamId = awayTeam ? awayTeam.id : null;
        }
    }

    return matches;
}
