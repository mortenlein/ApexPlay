'use client';

import React, { useEffect, useMemo, useState, use } from 'react';
import { useSearchParams } from 'next/navigation';
import { clientApi } from '@/lib/client-api';

/**
 * The OBS roster board. Its viewer is a compositor at a fixed canvas size (1920x1080) with
 * nobody to scroll it, so everything it renders has to be inside the frame:
 *
 *  - the column count follows the team count (2 / 4 / 6),
 *  - the grid owns the full height with `1fr` rows, so a card can never spill past the frame,
 *  - card and type sizes are derived from `--rows` / `--players` so four compact rows stay
 *    legible where two roomy ones were,
 *  - and when a LAN is too big for one screen (32 teams of 5, say) the board pages itself:
 *    `?page=2` pins a page, `?rotate=0` freezes it, otherwise pages rotate every 8s.
 */
const ROTATE_MS = 8000;

/** Columns for a given team count: 2 up to 4 teams, 4 up to 16, 6 beyond. */
const columnsFor = (teamCount: number) => (teamCount <= 4 ? 2 : teamCount <= 16 ? 4 : 6);

/** How many card rows still read at 1080p: four compact rows, three once rosters get deep. */
const maxRowsFor = (playersPerTeam: number) => (playersPerTeam >= 5 ? 3 : 4);

function chunk<T>(items: T[], size: number): T[][] {
    if (size <= 0) return [items];
    const pages: T[][] = [];
    for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
    return pages.length > 0 ? pages : [[]];
}

export default function RosterOverlay(props: { params: Promise<{ id: string }> }) {
    const params = use(props.params);
    const searchParams = useSearchParams();
    const chromaKey = searchParams.get('chroma') || 'transparent';
    const pinnedPage = Number.parseInt(searchParams.get('page') || '', 10);
    const rotateDisabled = searchParams.get('rotate') === '0';

    const [teams, setTeams] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [pageIndex, setPageIndex] = useState(0);

    useEffect(() => {
        const fetchTeams = async () => {
            try {
                const data = await clientApi.getTeams(params.id);
                if (Array.isArray(data)) {
                    setTeams(data);
                }
            } catch (error) {
                console.error('Failed to fetch teams', error);
            } finally {
                setLoading(false);
            }
        };
        fetchTeams();
        const interval = setInterval(fetchTeams, 10000); // Polling every 10s
        return () => clearInterval(interval);
    }, [params.id]);

    // Layout: columns from the team count, rows capped so the cards stay readable, and the
    // leftovers spread over rotating pages.
    const layout = useMemo(() => {
        const cols = columnsFor(teams.length);
        const playersPerTeam = teams.reduce((most, team) => Math.max(most, team.players?.length || 0), 0);
        const perPage = cols * maxRowsFor(playersPerTeam);
        const pages = chunk(teams, perPage);
        const rows = Math.max(1, Math.ceil(Math.min(teams.length || 1, perPage) / cols));
        return { cols, rows, pages, playersPerTeam: Math.max(1, playersPerTeam) };
    }, [teams]);

    const pinned = Number.isFinite(pinnedPage) && pinnedPage >= 1 ? Math.min(pinnedPage, layout.pages.length) - 1 : null;
    const activeIndex = pinned ?? Math.min(pageIndex, layout.pages.length - 1);
    const rotating = pinned === null && !rotateDisabled && layout.pages.length > 1;

    // Rotate through the pages so an OBS source with no scrollbar still shows every team.
    useEffect(() => {
        if (!rotating) return;
        const pageCount = layout.pages.length;
        const timer = setInterval(() => setPageIndex((current) => (current + 1) % pageCount), ROTATE_MS);
        return () => clearInterval(timer);
    }, [rotating, layout.pages.length]);

    if (loading) return null;

    // Helper to extract up to 2 letters for the team initial block
    const getInitials = (name: string) => {
        if (!name) return '??';
        const words = name.trim().split(/\s+/);
        if (words.length >= 2) {
            return (words[0][0] + words[1][0]).toUpperCase();
        }
        return name.slice(0, 2).toUpperCase();
    };

    // Helper to generate a deterministic color based on team name string
    const stringToColor = (str: string) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const h = Math.abs(hash) % 360;
        return `hsl(${h}, 70%, 50%)`;
    };

    const visibleTeams = layout.pages[activeIndex] || [];

    // Everything below scales off these two: one row of four cards gets smaller type than one
    // row of two, and a five-man roster gets tighter player rows than a duo.
    const frameStyle = {
        backgroundColor: chromaKey === 'transparent' ? 'transparent' : chromaKey,
        padding: 'clamp(0.75rem, 2vh, 3rem)',
        ['--rows' as any]: layout.rows,
        ['--cols' as any]: layout.cols,
        ['--players' as any]: layout.playersPerTeam,
    } as React.CSSProperties;

    const gridStyle = {
        gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))`,
        gap: 'clamp(0.5rem, calc(6vh / var(--rows)), 2rem)',
    } as React.CSSProperties;

    const avatarSize = 'clamp(2rem, calc(18vh / var(--rows)), 4rem)';
    const nameSize = 'clamp(0.8rem, calc(7vh / var(--rows)), 1.5rem)';
    const playerSize = 'clamp(0.55rem, calc(70vh / (var(--rows) * (var(--players) + 3))), 1.1rem)';

    return (
        <div
            className="w-screen h-screen overflow-hidden flex flex-col"
            style={frameStyle}
            data-testid="roster-board"
            data-page={activeIndex + 1}
            data-pages={layout.pages.length}
            data-columns={layout.cols}
        >
            <div className="flex-1 min-h-0 grid" style={gridStyle}>
                {visibleTeams.map((team, idx) => (
                    <div
                        key={team.id || idx}
                        className="bg-black/80 border-2 border-gray-800 rounded-3xl shadow-2xl backdrop-blur-sm flex flex-col min-h-0 overflow-hidden"
                        style={{
                            padding: 'clamp(0.5rem, calc(5vh / var(--rows)), 1.5rem)',
                            gap: 'clamp(0.4rem, calc(4vh / var(--rows)), 1.25rem)',
                        }}
                    >
                        {/* Team Header */}
                        <div
                            className="flex items-center border-b border-gray-800 shrink-0"
                            style={{
                                gap: 'clamp(0.5rem, calc(4vh / var(--rows)), 1.25rem)',
                                paddingBottom: 'clamp(0.35rem, calc(3.5vh / var(--rows)), 1.25rem)',
                            }}
                        >
                            <div
                                className="rounded-2xl flex items-center justify-center font-black text-white shadow-inner flex-shrink-0"
                                style={{
                                    backgroundColor: stringToColor(team.name || ''),
                                    width: avatarSize,
                                    height: avatarSize,
                                    fontSize: `calc(${nameSize} * 0.9)`,
                                }}
                            >
                                {getInitials(team.name)}
                            </div>
                            <div className="flex flex-col min-w-0 truncate">
                                <span
                                    className="text-gray-500 font-bold uppercase tracking-[0.3em]"
                                    style={{ fontSize: `calc(${playerSize} * 0.7)` }}
                                >
                                    Seed #{team.seed || '?'}
                                </span>
                                <h2
                                    className="font-black text-white uppercase tracking-tighter truncate m-0"
                                    style={{ fontSize: nameSize }}
                                >
                                    {team.name}
                                </h2>
                            </div>
                        </div>

                        {/* Players List */}
                        <div
                            className="flex-1 min-h-0 flex flex-col overflow-hidden"
                            style={{ gap: 'clamp(0.15rem, calc(2vh / var(--rows)), 0.75rem)' }}
                        >
                            {team.players && team.players.length > 0 ? (
                                team.players.map((p: any, i: number) => (
                                    <div
                                        key={p.id || i}
                                        className="flex items-center justify-between gap-2 bg-white/5 rounded-xl border border-white/5 min-h-0"
                                        style={{
                                            padding: 'clamp(0.15rem, calc(1.6vh / var(--rows)), 0.75rem) clamp(0.35rem, calc(2vh / var(--rows)), 0.75rem)',
                                        }}
                                    >
                                        <span
                                            className="text-gray-300 font-bold uppercase tracking-wider truncate"
                                            style={{ fontSize: playerSize }}
                                        >
                                            {p.name}
                                        </span>
                                        {p.seating && (
                                            <span
                                                className="text-blue-400 font-black font-mono bg-blue-900/30 px-2 py-0.5 rounded shrink-0"
                                                style={{ fontSize: `calc(${playerSize} * 0.8)` }}
                                            >
                                                {p.seating}
                                            </span>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div
                                    className="text-center text-gray-600 font-black uppercase tracking-widest py-4 opacity-50"
                                    style={{ fontSize: `calc(${playerSize} * 0.8)` }}
                                >
                                    No Players Enrolled
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Paging readout: only when the board actually pages, so a one-screen LAN is unchanged. */}
            {layout.pages.length > 1 && (
                <div className="shrink-0 pt-2 flex justify-center">
                    <span className="text-gray-500 font-black font-mono text-xs tracking-[0.3em] uppercase">
                        {activeIndex + 1} / {layout.pages.length}
                    </span>
                </div>
            )}
        </div>
    );
}
