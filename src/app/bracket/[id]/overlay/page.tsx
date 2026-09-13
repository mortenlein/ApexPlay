'use client';

import React, { useMemo, useEffect, useState, useCallback, use } from 'react';
import { useSearchParams } from 'next/navigation';
import ReactFlow, { Background, Edge, Node, Handle, Position } from 'reactflow';
import 'reactflow/dist/style.css';
import { useMatchStream } from '@/hooks/useMatchStream';
import { clientApi } from '@/lib/client-api';
import { isCalled, isDone, isLive, matchStatusLabel } from '@/lib/match-status';

/**
 * The one place the overlay prints a match's state, so it is derived from the canonical
 * status vocabulary (src/lib/match-status.ts) rather than from string comparisons: a status
 * added there shows up on stream without another edit here.
 */
/**
 * Broadcast status line. The WORDS come from the canonical vocabulary
 * (matchStatusLabel) so the stream can never disagree with the admin screen; the SHOUTING is
 * CSS, which is also why tests read "Live" here and viewers see "LIVE".
 */
const StreamState = ({ status }: { status?: string | null }) => {
    const label = matchStatusLabel(status);
    if (isLive(status)) {
        return (
            <span className="text-red-500 flex items-center gap-2 uppercase">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]"></span>
                {label}
            </span>
        );
    }
    const tone = isDone(status) ? 'text-green-500' : isCalled(status) ? 'text-blue-400' : 'text-gray-500';
    return <span className={`${tone} uppercase`}>{label}</span>;
};

// A custom high-contrast node for the overlay
const StreamMatchNode = ({ data }: any) => {
    const isRightSide = data.isRightSide;
    const isCenter = data.isCenter;
    const isThirdPlace = data.isThirdPlace;

    return (
        <div className={`bg-[#0a0a0a] border-4 ${isCenter && !isThirdPlace ? 'border-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.5)]' : 'border-gray-700 shadow-2xl'} text-white p-5 rounded-2xl w-80 font-sans`}>
            {/* Target Handles */}
            {isCenter ? (
                <>
                    <Handle type="target" position={Position.Left} id="left" style={{ opacity: 0 }} />
                    <Handle type="target" position={Position.Right} id="right" style={{ opacity: 0 }} />
                </>
            ) : isThirdPlace ? (
                <>
                    <Handle type="target" position={Position.Top} id="top-left" style={{ left: '25%', opacity: 0 }} />
                    <Handle type="target" position={Position.Top} id="top-right" style={{ left: '75%', opacity: 0 }} />
                </>
            ) : (
                <Handle type="target" position={isRightSide ? Position.Right : Position.Left} style={{ opacity: 0 }} />
            )}

            {/* Source Handle */}
            {!isCenter && !isThirdPlace && (
                <>
                    <Handle type="source" position={isRightSide ? Position.Left : Position.Right} id="main" style={{ opacity: 0 }} />
                    <Handle type="source" position={Position.Bottom} id="loser" style={{ opacity: 0 }} />
                </>
            )}

            {data.stageName && (
                <div className={`absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap z-10 ${
                    isThirdPlace
                        ? 'bg-gray-700 text-white'
                        : isCenter
                        ? 'bg-yellow-500 text-black'
                        : 'bg-yellow-500/80 text-black'
                }`}>
                    {data.stageName}
                </div>
            )}

            <div className="flex flex-col gap-4">
                {/* Home Team */}
                <div className="flex justify-between items-center bg-black/50 p-3 rounded-xl border border-gray-800">
                    <div className="flex flex-col truncate pr-2">
                        <span className="truncate text-xl font-black uppercase tracking-wider text-white">{data.homeTeam?.name || 'TBD'}</span>
                        {data.homeTeam?.players?.length > 0 && (
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest truncate mt-0.5">
                                {data.homeTeam.players.map((p: any) => p.seating ? `${p.seating}:${p.name}` : p.name).join(' • ')}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="flex gap-1.5 opacity-60">
                            {data.mapScores?.map((m: any, i: number) => (
                                <span key={`h-${i}`} className="text-[10px] font-mono font-bold tracking-tighter bg-white/10 px-1 rounded flex gap-1">
                                    {m.map && <span className="text-gray-500">{m.map}</span>}
                                    <span className="text-white">{m.home}</span>
                                </span>
                            ))}
                        </div>
                        <span className="text-3xl text-yellow-400 font-black font-mono tracking-tighter">{data.homeScore}</span>
                    </div>
                </div>

                {/* Away Team */}
                <div className="flex justify-between items-center bg-black/50 p-3 rounded-xl border border-gray-800">
                    <div className="flex flex-col truncate pr-2">
                        <span className="truncate text-xl font-black uppercase tracking-wider text-white">{data.awayTeam?.name || 'TBD'}</span>
                        {data.awayTeam?.players?.length > 0 && (
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest truncate mt-0.5">
                                {data.awayTeam.players.map((p: any) => p.seating ? `${p.seating}:${p.name}` : p.name).join(' • ')}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="flex gap-1.5 opacity-60">
                            {data.mapScores?.map((m: any, i: number) => (
                                <span key={`a-${i}`} className="text-[10px] font-mono font-bold tracking-tighter bg-white/10 px-1 rounded flex gap-1">
                                    {m.map && <span className="text-gray-500">{m.map}</span>}
                                    <span className="text-white">{m.away}</span>
                                </span>
                            ))}
                        </div>
                        <span className="text-3xl text-yellow-400 font-black font-mono tracking-tighter">{data.awayScore}</span>
                    </div>
                </div>
            </div>

            {/* The state line is unconditional: a BO1 quarter-final needs LIVE/FINAL on stream
                just as much as the grand final does. */}
            <div className="mt-4 pt-3 border-t border-gray-800 flex justify-between items-center text-[10px] text-gray-600 font-bold uppercase tracking-widest">
                <span>{`BEST OF ${data.bestOf > 1 ? data.bestOf : 1}`}</span>
                <StreamState status={data.status} />
            </div>
        </div>
    );
};

export default function StreamOverlay(props: { params: Promise<{ id: string }> }) {
    const params = use(props.params);
    const searchParams = useSearchParams();
    const compact = searchParams.get('compact') === 'true';
    const chromaKey = searchParams.get('chroma') || 'transparent';

    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);
    const [loading, setLoading] = useState(true);
    const [matchesData, setMatchesData] = useState<any[]>([]);

    // Stabilize nodeTypes to prevent React Flow re-initialization cycles
    const nodeTypes = useMemo(() => ({ streamMatch: StreamMatchNode }), []);

    const buildNodesAndEdges = useCallback((matches: any[]) => {
        if (!Array.isArray(matches) || matches.length === 0) {
            setLoading(false);
            return;
        }

        const X_OFFSET = 600;
        const Y_OFFSET = 400;
        const winnerMatches = matches.filter(m => m.bracketType === 'WINNERS');
        const totalRounds = winnerMatches.length > 0 ? Math.max(...winnerMatches.map(m => m.round)) : 1;

        const getStageName = (round: number, bracketType: string): string => {
            if (bracketType === 'THIRD_PLACE') return 'Third Place Match';
            const matchesInThisRound = matches.filter(m => m.round === round && m.bracketType === 'WINNERS').length;
            const stepsFromFinal = totalRounds - round;

            if (stepsFromFinal === 0 && matchesInThisRound === 1) return 'Grand Finals';
            if (stepsFromFinal === 1 && matchesInThisRound <= 2) return 'Semi-Finals';
            if (stepsFromFinal === 2 && matchesInThisRound <= 4) return 'Quarter-Finals';
            return `Round ${round}`;
        };

        const newNodes: Node[] = matches.map((match: any) => {
            const r = match.round || 1;
            const m = match.matchOrder || 0;
            const isWinnerBracket = match.bracketType === 'WINNERS';
            const isThirdPlace = match.bracketType === 'THIRD_PLACE';
            const matchesInThisRound = matches.filter((mm: any) => mm.round === r && mm.bracketType === match.bracketType).length || 1;
            
            // Only center the Grand Final (single match in the last round)
            const isCenter = isWinnerBracket && r === totalRounds && matchesInThisRound === 1;

            let x = 0;
            let y = 0;
            let isRightSide = false;

            if (isThirdPlace) {
                x = 0;
                y = Y_OFFSET * 1.5;
            } else if (isCenter) {
                x = 0;
                y = 0;
            } else {
                const halfMatches = matchesInThisRound / 2;
                isRightSide = m >= halfMatches;
                const xSteps = totalRounds - r;
                x = isRightSide ? xSteps * X_OFFSET : -xSteps * X_OFFSET;
                const localM = isRightSide ? m - halfMatches : m;
                y = (localM - (halfMatches - 1) / 2) * Y_OFFSET * Math.pow(1.5, r - 1);
            }

            let parsedMapScores = [];
            try {
                if (typeof match.mapScores === 'string') {
                    parsedMapScores = JSON.parse(match.mapScores);
                } else if (Array.isArray(match.mapScores)) {
                    parsedMapScores = match.mapScores;
                }
            } catch (e) {
                console.error(`Failed to parse mapScores for match ${match.id}`, e);
            }

            return {
                id: match.id,
                type: 'streamMatch',
                position: { x, y },
                data: {
                    homeTeam: match.homeTeam,
                    homeScore: match.homeScore || 0,
                    awayTeam: match.awayTeam,
                    awayScore: match.awayScore || 0,
                    mapScores: parsedMapScores,
                    bestOf: match.bestOf || 1,
                    status: match.status || 'PENDING',
                    isRightSide,
                    isCenter,
                    isThirdPlace,
                    stageName: getStageName(r, match.bracketType)
                }
            };
        });

        const newEdges: Edge[] = [];
        matches.forEach((m: any) => {
            if (m.nextMatchId) {
                const targetMatch = matches.find((t: any) => t.id === m.nextMatchId);
                if (targetMatch) {
                    const isSourceRight = (m.matchOrder >= Math.pow(2, totalRounds - m.round) / 2);
                    const isTargetCenter = targetMatch.round === totalRounds;
                    let targetHandle = undefined;
                    if (isTargetCenter) {
                        targetHandle = isSourceRight ? 'right' : 'left';
                    }
                    newEdges.push({
                        id: `we-${m.id}-${m.nextMatchId}`,
                        source: m.id,
                        sourceHandle: 'main',
                        target: m.nextMatchId,
                        targetHandle,
                        type: 'smoothstep',
                        style: { strokeWidth: 4, stroke: '#3b82f6' },
                        animated: m.status === 'IN_PROGRESS' || m.status === 'PENDING' || m.status === 'LIVE'
                    });
                }
            }
            if (m.loserNextMatchId) {
                const isSourceRight = (m.matchOrder >= Math.pow(2, totalRounds - m.round) / 2);
                newEdges.push({
                    id: `le-${m.id}-${m.loserNextMatchId}`,
                    source: m.id,
                    sourceHandle: 'loser',
                    target: m.loserNextMatchId,
                    targetHandle: isSourceRight ? 'top-right' : 'top-left',
                    type: 'smoothstep',
                    style: { strokeWidth: 3, stroke: '#ef4444', strokeDasharray: '5,5' },
                    animated: true
                });
            }
        });

        setNodes(newNodes);
        setEdges(newEdges);
    }, []);

    // Initial fetch
    useEffect(() => {
        const fetchMatches = async () => {
            try {
                const matches = await clientApi.getMatches(params.id);
                if (Array.isArray(matches)) {
                    setMatchesData(matches);
                    buildNodesAndEdges(matches);
                }
            } catch (error) {
                console.error('Overlay fetch error:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchMatches();
    }, [params.id, buildNodesAndEdges]);

    // Real-time SSE updates
    useMatchStream(params.id, (data) => {
        setMatchesData((prev) => {
            const updated = prev.map((m) => m.id === data.matchId ? data.match : m);
            buildNodesAndEdges(updated);
            return updated;
        });
    });

    if (loading) return (
        <div className="w-screen h-screen bg-[#0a0a0a] flex items-center justify-center">
            <div className="flex flex-col items-center gap-6">
                <div className="w-20 h-20 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                <span className="text-gray-500 font-black uppercase tracking-[0.3em] text-xs animate-pulse">Loading Bracket...</span>
            </div>
        </div>
    );

    if (matchesData.length === 0) return (
        <div className="w-screen h-screen bg-[#0a0a0a] flex items-center justify-center">
            <div className="text-gray-700 font-bold uppercase tracking-widest text-sm">No match data available for this tournament</div>
        </div>
    );

    const bgColor = chromaKey === 'transparent' ? 'transparent' : chromaKey;

    return (
        <div
            className={`w-screen h-screen overflow-hidden ${compact ? 'scale-75 origin-top-left' : ''}`}
            style={{ backgroundColor: bgColor }}
        >
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.1 }}
                proOptions={{ hideAttribution: true }}
            >
                <Background variant={'none' as any} />
            </ReactFlow>

            <style jsx global>{`
                html, body {
                    background: ${bgColor} !important;
                    margin: 0;
                    padding: 0;
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.6; transform: scale(1.1); }
                }
                .animate-pulse {
                    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                }
                .react-flow__renderer,
                .react-flow__container,
                .react-flow__pane,
                .react-flow__viewport {
                    background: transparent !important;
                }
                .react-flow__handle {
                    visibility: hidden;
                }
                .react-flow__attribution {
                    display: none !important;
                }
            `}</style>
        </div>
    );
}
