export type BracketSlot = "HOME" | "AWAY";

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
    // Optional, additive: single-elimination leaves these undefined and keeps its existing
    // behaviour (winner -> WINNERS, slot by matchOrder parity). Double-elimination sets them
    // so winners/losers can be routed across WINNERS/LOSERS/GRAND_FINAL with explicit slots.
    nextMatchBracketType?: string;
    loserNextMatchBracketType?: string;
    nextMatchSlot?: BracketSlot;
    loserNextMatchSlot?: BracketSlot;
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

// Standard "meet in the middle" seeding order for a bracket of `slots` (a power of two):
// 1 plays the lowest seed, 2 the next, etc., so top seeds only meet in later rounds.
export function standardSeedOrder(slots: number): number[] {
    if (slots <= 1) return [1];
    let current = [1, 2];
    for (let i = 2; i < Math.log2(slots) + 1; i++) {
        const sum = Math.pow(2, i) + 1;
        const next: number[] = [];
        for (const s of current) {
            next.push(s);
            next.push(sum - s);
        }
        current = next;
    }
    return current;
}

/**
 * Double elimination (v1): a full winners bracket + losers bracket and a single grand final.
 *
 * Scope/limitations (documented, not silent):
 *  - Requires a power-of-two team count (4, 8, 16, 32). Non-power-of-two throws; the API turns
 *    that into a clear validation error rather than quietly building a different bracket.
 *  - Grand final is a single match (no bracket reset). Losers-bracket matches are BO1; the
 *    grand final mirrors the winners-final best-of. Both are reasonable LAN defaults.
 *
 * Routing uses (round, matchOrder, bracketType) coordinates plus explicit HOME/AWAY slots so
 * the generic advancement code can move winners/losers across WINNERS, LOSERS and GRAND_FINAL.
 * Losers-bracket rounds are numbered 1..2(k-1): odd = "minor" (LB winners pair up),
 * even = "major" (an LB winner meets a team just dropped from the winners bracket).
 */
export function generateDoubleElimination(
    teams: { id: string; seed: number | null }[],
    options: GenerateOptions = {}
): BracketMatch[] {
    const numTeams = teams.length;
    const isPowerOfTwo = numTeams >= 4 && (numTeams & (numTeams - 1)) === 0;
    if (!isPowerOfTwo) {
        throw new Error(
            `Double elimination currently requires a power-of-two team count (4, 8, 16, 32). Received ${numTeams}.`
        );
    }

    const sortedTeams = [...teams].sort((a, b) => (a.seed || 999) - (b.seed || 999));
    const k = Math.log2(numTeams); // number of winners-bracket rounds
    const numSlots = numTeams;
    const matches: BracketMatch[] = [];

    const getFormat = (currentRound: number) => {
        const bo5Start = options.bo5StartRound;
        const bo3Start = options.bo3StartRound;
        if (bo5Start && bo5Start > 0 && currentRound >= bo5Start) return { bestOf: 5, limit: 3 };
        if (bo3Start && bo3Start > 0 && currentRound >= bo3Start) return { bestOf: 3, limit: 2 };
        return { bestOf: 1, limit: 1 };
    };

    // --- Winners bracket ---
    for (let r = 1; r <= k; r++) {
        const matchesInRound = Math.pow(2, k - r);
        const format = getFormat(r);
        for (let m = 0; m < matchesInRound; m++) {
            const isFinal = r === k;
            const wb: BracketMatch = {
                round: r,
                matchOrder: m,
                homeTeamId: null,
                awayTeamId: null,
                bestOf: format.bestOf,
                scoreLimit: format.limit,
                bracketType: "WINNERS",
                nextMatchRound: isFinal ? 1 : r + 1,
                nextMatchOrder: isFinal ? 0 : Math.floor(m / 2),
                nextMatchBracketType: isFinal ? "GRAND_FINAL" : "WINNERS",
                nextMatchSlot: isFinal ? "HOME" : (m % 2 === 0 ? "HOME" : "AWAY"),
                loserNextMatchBracketType: "LOSERS",
                loserNextMatchRound: null,
                loserNextMatchOrder: null,
            };
            if (r === 1) {
                // R1 losers fill the first minor round, two per match.
                wb.loserNextMatchRound = 1;
                wb.loserNextMatchOrder = Math.floor(m / 2);
                wb.loserNextMatchSlot = m % 2 === 0 ? "HOME" : "AWAY";
            } else {
                // Later WB losers drop into a major LB round, one per match (AWAY side).
                wb.loserNextMatchRound = 2 * (r - 1);
                wb.loserNextMatchOrder = m;
                wb.loserNextMatchSlot = "AWAY";
            }
            matches.push(wb);
        }
    }

    // --- Losers bracket ---
    const lbRounds = 2 * (k - 1);
    for (let L = 1; L <= lbRounds; L++) {
        const isMinor = L % 2 === 1;
        const j = Math.ceil(L / 2); // 1..(k-1)
        const matchesInRound = Math.pow(2, k - 1 - j);
        const isLbFinal = L === lbRounds;
        for (let m = 0; m < matchesInRound; m++) {
            const lb: BracketMatch = {
                round: L,
                matchOrder: m,
                homeTeamId: null,
                awayTeamId: null,
                bestOf: 1,
                scoreLimit: 1,
                bracketType: "LOSERS",
                loserNextMatchRound: null,
                loserNextMatchOrder: null,
                nextMatchRound: null,
                nextMatchOrder: null,
                nextMatchBracketType: "LOSERS",
            };
            if (isLbFinal) {
                lb.nextMatchRound = 1;
                lb.nextMatchOrder = 0;
                lb.nextMatchBracketType = "GRAND_FINAL";
                lb.nextMatchSlot = "AWAY";
            } else if (isMinor) {
                // Minor winner meets the WB dropper in the next (major) round, HOME side.
                lb.nextMatchRound = L + 1;
                lb.nextMatchOrder = m;
                lb.nextMatchSlot = "HOME";
            } else {
                // Major winner advances to the next minor round.
                lb.nextMatchRound = L + 1;
                lb.nextMatchOrder = Math.floor(m / 2);
                lb.nextMatchSlot = m % 2 === 0 ? "HOME" : "AWAY";
            }
            matches.push(lb);
        }
    }

    // --- Grand final (single match) ---
    const gfFormat = getFormat(k);
    matches.push({
        round: 1,
        matchOrder: 0,
        homeTeamId: null,
        awayTeamId: null,
        bestOf: gfFormat.bestOf,
        scoreLimit: gfFormat.limit,
        bracketType: "GRAND_FINAL",
        nextMatchRound: null,
        nextMatchOrder: null,
        loserNextMatchRound: null,
        loserNextMatchOrder: null,
    });

    // --- Seed the winners-bracket round 1 ---
    const seeds = standardSeedOrder(numSlots);
    const round1Matches = matches.filter((mm) => mm.bracketType === "WINNERS" && mm.round === 1);
    for (let i = 0; i < numSlots / 2; i++) {
        const homeTeam = sortedTeams[seeds[i * 2] - 1];
        const awayTeam = sortedTeams[seeds[i * 2 + 1] - 1];
        const match = round1Matches.find((mm) => mm.matchOrder === i);
        if (match) {
            match.homeTeamId = homeTeam ? homeTeam.id : null;
            match.awayTeamId = awayTeam ? awayTeam.id : null;
        }
    }

    return matches;
}
