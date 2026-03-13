'use client';

import React, { useMemo, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ReactFlow, { Background, Edge, Node, Handle, Position } from 'reactflow';
import 'reactflow/dist/style.css';

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

            {isCenter && !isThirdPlace && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-yellow-500 text-black px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap z-10">
                    Grand Final
                </div>
            )}

            {isThirdPlace && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gray-700 text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap z-10">
                    Third Place Decider
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

            {(data.bestOf > 1 || isCenter || isThirdPlace) && (
                <div className="mt-4 pt-3 border-t border-gray-800 flex justify-between items-center text-[10px] text-gray-600 font-bold uppercase tracking-widest">
                    <span>{data.bestOf > 1 ? `BEST OF ${data.bestOf}` : 'BEST OF 1'}</span>
                    <span className={data.status === 'COMPLETED' ? 'text-green-500' : 'text-blue-500'}>
                        {data.status === 'COMPLETED' ? 'FINAL' : 'IN PROGRESS'}
                    </span>
                </div>
            )}
        </div>
    );
};

export default function StreamOverlay({ params }: { params: { id: string } }) {
    const searchParams = useSearchParams();
    const compact = searchParams.get('compact') === 'true';
    const chromaKey = searchParams.get('chroma') || 'transparent';

    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);
    const [loading, setLoading] = useState(true);

    const nodeTypes = useMemo(() => ({ streamMatch: StreamMatchNode }), []);

    useEffect(() => {
        const fetchMatches = async () => {
            try {
                const res = await fetch(`/api/tournaments/${params.id}/matches`);
                const matches = await res.json();

                if (!Array.isArray(matches) || matches.length === 0) return;

                // Mathematical Meet-in-the-Middle Layout Constants
                const X_OFFSET = 450;
                const Y_OFFSET = 250;

                // Find total rounds by looking at the main bracket max round
                const totalRounds = Math.max(...matches.filter(m => m.bracketType === 'WINNERS').map(m => m.round));

                const newNodes: Node[] = matches.map((match: any) => {
                    const r = match.round;
                    const m = match.matchOrder;
                    const isWinnerBracket = match.bracketType === 'WINNERS';
                    const isThirdPlace = match.bracketType === 'THIRD_PLACE';

                    // Determine position
                    let x = 0;
                    let y = 0;
                    let isRightSide = false;
                    const isCenter = isWinnerBracket && r === totalRounds;

                    if (isThirdPlace) {
                        x = 0;
                        y = Y_OFFSET * 1.5; // Below the final
                    } else if (isCenter) {
                        x = 0;
                        y = 0;
                    } else {
                        // Winner Bracket Nodes mapping
                        const matchesInRound = Math.pow(2, totalRounds - r);
                        const halfMatches = matchesInRound / 2;

                        isRightSide = m >= halfMatches;

                        // X positioning
                        const xSteps = totalRounds - r;
                        x = isRightSide ? xSteps * X_OFFSET : -xSteps * X_OFFSET;

                        // Y positioning (center at 0)
                        const localM = isRightSide ? m - halfMatches : m;
                        // For a branch of size `halfMatches`, index `localM` vertically centered:
                        y = (localM - (halfMatches - 1) / 2) * Y_OFFSET * Math.pow(1.5, r - 1);
                    }

                    return {
                        id: match.id,
                        type: 'streamMatch',
                        position: { x, y },
                        data: {
                            homeTeam: match.homeTeam,
                            homeScore: match.homeScore,
                            awayTeam: match.awayTeam,
                            awayScore: match.awayScore,
                            mapScores: typeof match.mapScores === 'string' ? JSON.parse(match.mapScores) : (match.mapScores || []),
                            bestOf: match.bestOf,
                            status: match.status,
                            isRightSide,
                            isCenter,
                            isThirdPlace
                        }
                    };
                });

                const newEdges: Edge[] = [];

                matches.forEach((m: any) => {
                    // Winner advancement edge
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
                                type: 'smoothstep', // Gives that bracket orthogonal feel with smooth corners
                                style: { strokeWidth: 4, stroke: '#3b82f6' },
                                animated: m.status === 'IN_PROGRESS' || m.status === 'PENDING'
                            });
                        }
                    }

                    // Loser advancement edge (for 3rd place usually from semis)
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
            } catch (error) {
                console.error('Overlay fetch error:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchMatches();
        const interval = setInterval(fetchMatches, 10000); // Polling every 10s
        return () => clearInterval(interval);
    }, [params.id]);

    if (loading) return null;

    return (
        <div
            className={`w-screen h-screen overflow-hidden ${compact ? 'scale-75 origin-top-left' : ''}`}
            style={{ backgroundColor: chromaKey === 'transparent' ? 'transparent' : chromaKey }}
        >
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.1 }}
                proOptions={{ hideAttribution: true }}
            >
                <Background color="#fff" gap={20} variant={chromaKey === 'transparent' ? 'dots' as any : 'none' as any} />
            </ReactFlow>

            <style jsx global>{`
                .react-flow__pane {
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
