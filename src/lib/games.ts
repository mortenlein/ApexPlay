export type GameCategory = 'BRACKET' | 'BATTLE_ROYALE';

export interface GameMetadata {
    id: string;
    name: string;
    category: GameCategory;
    type: string; // Used for UI display
    teamSize: number[];
    teamSizeLabels?: Record<number, string>;
    hasIntegration: boolean;
    logoUrl: string;
    bannerUrl: string;
    bannerPosition?: string;
}

export const SUPPORTED_GAMES: GameMetadata[] = [
    { 
        id: 'CS2', 
        name: 'Counter-Strike 2', 
        category: 'BRACKET', 
        type: 'Tactical',
        teamSize: [2, 5], 
        hasIntegration: true,
        logoUrl: '/images/games/cs2_logo.png',
        bannerUrl: '/images/games/cs2_banner.jpg',
        bannerPosition: 'right center'
    },
    { 
        id: 'FORTNITE', 
        name: 'Fortnite', 
        category: 'BATTLE_ROYALE', 
        type: 'Royale',
        teamSize: [1, 2, 3, 4], 
        teamSizeLabels: { 1: 'Solo', 2: 'Duos', 3: 'Trios', 4: 'Squads' },
        hasIntegration: false,
        logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Fortnite_F_lettermark_logo.png',
        bannerUrl: '/images/games/fortnite_banner.jpg',
        bannerPosition: 'center center'
    },
    { 
        id: 'VALORANT', 
        name: 'Valorant', 
        category: 'BRACKET', 
        type: 'Tactical',
        teamSize: [1, 2, 3, 5], 
        teamSizeLabels: { 1: '1v1', 2: '2v2', 3: '3v3', 5: '5v5' },
        hasIntegration: false,
        logoUrl: '/images/games/valorant_logo.svg',
        bannerUrl: '/images/games/valorant_banner.jpg',
        bannerPosition: 'center 20%'
    },
    { 
        id: 'RAINBOW6', 
        name: 'Rainbow Six Siege', 
        category: 'BRACKET', 
        type: 'Tactical',
        teamSize: [1, 2, 3, 5], 
        teamSizeLabels: { 1: '1v1 / FFA', 2: '2v2', 3: '3v3', 5: '5v5' },
        hasIntegration: false,
        logoUrl: '/images/games/r6_logo.png',
        bannerUrl: '/images/games/r6_banner.jpg',
        bannerPosition: 'center 15%'
    },
    { 
        id: 'PUBG', 
        name: 'PUBG', 
        category: 'BATTLE_ROYALE', 
        type: 'Royale',
        teamSize: [1, 2, 3, 4, 5], 
        teamSizeLabels: { 1: 'Solo', 2: '2v2', 3: '3v3', 4: 'Squads', 5: '5v5' },
        hasIntegration: false,
        logoUrl: '/images/games/pubg_logo.jpeg',
        bannerUrl: '/images/games/pubg_banner.jpg',
        bannerPosition: 'center 40%'
    },
];

export const CS2_MAP_POOLS = {
    '5v5': [
        { id: 'ancient', name: 'Ancient', shortName: 'ANC' },
        { id: 'anubis', name: 'Anubis', shortName: 'ANU' },
        { id: 'dust2', name: 'Dust II', shortName: 'D2' },
        { id: 'inferno', name: 'Inferno', shortName: 'INF' },
        { id: 'mirage', name: 'Mirage', shortName: 'MIR' },
        { id: 'nuke', name: 'Nuke', shortName: 'NUK' },
        { id: 'vertigo', name: 'Vertigo', shortName: 'VRT' }
    ],
    '2v2': [
        { id: 'inferno', name: 'Inferno', shortName: 'INF' },
        { id: 'nuke', name: 'Nuke', shortName: 'NUK' },
        { id: 'overpass', name: 'Overpass', shortName: 'OVP' },
        { id: 'vertigo', name: 'Vertigo', shortName: 'VRT' }
    ]
};

export function getGameMetadata(gameId: string): GameMetadata | undefined {
    return SUPPORTED_GAMES.find(g => g.id === gameId);
}

export function getMapPool(teamSize: number) {
    if (teamSize === 2) return CS2_MAP_POOLS['2v2'];
    return CS2_MAP_POOLS['5v5'];
}

/** Default team size for a game (the last, i.e. largest, supported entry). */
export function defaultTeamSize(game: GameMetadata): number {
    return game.teamSize[game.teamSize.length - 1];
}

export function teamSizeLabel(game: GameMetadata | undefined, size: number): string {
    return game?.teamSizeLabels?.[size] || `${size}v${size}`;
}

// --- Bracket format / series helpers (shared by the wizard, manage settings and the API) ---

export const TOURNAMENT_FORMATS = ['SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION'] as const;
export type TournamentFormat = (typeof TOURNAMENT_FORMATS)[number];

export const FORMAT_OPTIONS: { id: TournamentFormat; name: string; desc: string }[] = [
    { id: 'SINGLE_ELIMINATION', name: 'Single Elimination', desc: 'Direct bracket exit on loss' },
    { id: 'DOUBLE_ELIMINATION', name: 'Double Elimination', desc: 'Lower bracket second chance' },
];

export function isTournamentFormat(value: unknown): value is TournamentFormat {
    return typeof value === 'string' && (TOURNAMENT_FORMATS as readonly string[]).includes(value);
}

/**
 * Best-of stage options. The stored value is "last N rounds counted back from the final",
 * so it works for any bracket size: 0 = off, 1 = grand final only, 2 = semi-finals onward, etc.
 */
export const LAST_ROUNDS_MAX = 4;

/**
 * Best-of escalation is expressed as "the last N rounds", and each N names a bracket stage.
 * These are KEYS into the shared `stage` message namespace, not display strings — the wizard
 * and the settings card translate them, so the dropdown reads "Semifinale" in Norwegian rather
 * than leaking English into an otherwise translated screen.
 */
export const STAGE_LABEL_KEYS: Record<number, string> = {
    0: 'bracket.none',
    1: 'bracket.grandFinal',
    2: 'bracket.semiFinals',
    3: 'bracket.quarterFinals',
    4: 'bracket.roundOf16',
};

/** English fallback for non-React callers (logs, scripts). UI must translate the key instead. */
export const STAGE_LABELS: Record<number, string> = {
    0: 'None (BO1)',
    1: 'Grand Final',
    2: 'Semi-Finals',
    3: 'Quarter-Finals',
    4: 'Round of 16',
};

export const BO3_STAGES = [0, 1, 2, 3, 4];
export const BO5_STAGES = [0, 1, 2, 3];

export function stageLabel(value: number | null | undefined): string {
    return STAGE_LABELS[value ?? 0] ?? STAGE_LABELS[0];
}

/**
 * Lenient parse for untrusted input (the wizard sends strings, including the string '0' for "off").
 * NaN / missing / <= 0 all mean "off" (null); anything larger is clamped to LAST_ROUNDS_MAX.
 */
export function coerceLastRounds(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number.parseInt(String(value), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.min(parsed, LAST_ROUNDS_MAX);
}

/** Strict check used by PATCH: an integer 0..LAST_ROUNDS_MAX, or null for "off". */
export function isValidLastRounds(value: unknown): value is number | null {
    if (value === null) return true;
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= LAST_ROUNDS_MAX;
}
