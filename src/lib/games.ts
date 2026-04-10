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
