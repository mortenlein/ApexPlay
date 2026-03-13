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

export function getMapPool(teamSize: number) {
    if (teamSize === 2) return CS2_MAP_POOLS['2v2'];
    return CS2_MAP_POOLS['5v5']; // Default to 5v5 pool
}
