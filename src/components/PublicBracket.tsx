"use client";

import React, { useMemo } from 'react';
import Image from 'next/image';
import ReactFlow, { Background, Edge, Node, Handle, Position } from 'reactflow';
import 'reactflow/dist/style.css';
import { Trophy } from 'lucide-react';

const PublicMatchNode = ({ data }: any) => {
    const isCenter = data.isCenter;
    const isThirdPlace = data.isThirdPlace;

    return (
        <div className={`relative px-4 py-3 min-w-[260px] bg-[#1a1d21] border-2 transition-all duration-500 rounded-2xl group ${
            isCenter && !isThirdPlace 
            ? 'border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.15)] ring-4 ring-blue-500/10' 
            : 'border-white/5 hover:border-white/10 hover:bg-[#1f2227]'
        }`}>
            {/* Handles - Hidden but necessary for connections */}
            <Handle type="target" position={data.isRightSide ? Position.Right : Position.Left} style={{ opacity: 0 }} />
            <Handle type="source" position={data.isRightSide ? Position.Left : Position.Right} style={{ opacity: 0 }} />
            
            {data.stageName && (
                <div className={`absolute -top-3 left-6 px-3 py-1 rounded-full text-[7px] font-black uppercase tracking-[0.2em] whitespace-nowrap z-10 ${
                    isCenter ? 'bg-blue-600 text-white' : 'bg-[#2a2e35] text-gray-500'
                }`}>
                    {data.stageName}
                </div>
            )}

            <div className="flex flex-col gap-1.5">
                {/* Home Team */}
                <div className="flex items-center justify-between h-10 px-3 rounded-xl bg-black/20 group-hover:bg-black/40 transition-all border border-transparent hover:border-blue-500/20">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center shrink-0 border border-white/5 overflow-hidden relative">
                            {data.homeTeam?.logoUrl ? (
                                <Image src={data.homeTeam.logoUrl} alt="" fill className="object-contain" />
                            ) : (
                                <Trophy size={12} className="text-gray-600" />
                            )}
                        </div>
                        <span className="truncate text-[11px] font-extrabold uppercase tracking-tighter text-gray-300 group-hover:text-white transition-all">
                            {data.homeTeam?.name || 'Pending...'}
                        </span>
                    </div>
                    <span className={`text-lg font-extrabold font-mono transition-all ${data.homeScore > data.awayScore ? 'text-blue-500' : 'text-gray-700'}`}>
                        {data.homeScore}
                    </span>
                </div>

                {/* Away Team */}
                <div className="flex items-center justify-between h-10 px-3 rounded-xl bg-black/20 group-hover:bg-black/40 transition-all border border-transparent hover:border-blue-500/20">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center shrink-0 border border-white/5 overflow-hidden relative">
                             {data.awayTeam?.logoUrl ? (
                                <Image src={data.awayTeam.logoUrl} alt="" fill className="object-contain" />
                            ) : (
                                <Trophy size={12} className="text-gray-600" />
                            )}
                        </div>
                        <span className="truncate text-[11px] font-extrabold uppercase tracking-tighter text-gray-300 group-hover:text-white transition-all">
                            {data.awayTeam?.name || 'Pending...'}
                        </span>
                    </div>
                    <span className={`text-lg font-extrabold font-mono transition-all ${data.awayScore > data.homeScore ? 'text-blue-500' : 'text-gray-700'}`}>
                        {data.awayScore}
                    </span>
                </div>
            </div>

            {data.status === 'LIVE' && (
                <div className="absolute -right-1 -top-1">
                    <span className="flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]"></span>
                    </span>
                </div>
            )}
        </div>
    );
};

export default function PublicBracket({ tournamentId, matches }: { tournamentId: string, matches: any[] }) {
    const nodeTypes = useMemo(() => ({ publicMatch: PublicMatchNode }), []);

    const { nodes, edges } = useMemo(() => {
        if (!Array.isArray(matches) || matches.length === 0) return { nodes: [], edges: [] };

        const X_OFFSET = 380;
        const Y_OFFSET = 160;
        const winnersMatches = matches.filter(m => m.bracketType === 'WINNERS');
        const totalRounds = winnersMatches.length > 0 ? Math.max(...winnersMatches.map(m => m.round)) : 0;

        const getStageName = (round: number, bracketType: string): string => {
            if (bracketType === 'THIRD_PLACE') return '3RD PLACE BATTLE';
            const stepsFromFinal = totalRounds - round;
            switch (stepsFromFinal) {
                case 0: return 'GRAND FINALS';
                case 1: return 'SEMI FINALS';
                case 2: return 'QUARTER FINALS';
                case 3: return 'R16 ELIMINATION';
                default: return `POOLS ROUND ${round}`;
            }
        };

        const newNodes: Node[] = matches.map((match: any) => {
            const r = match.round;
            const m = match.matchOrder;
            const isWinnerBracket = match.bracketType === 'WINNERS';
            const isThirdPlace = match.bracketType === 'THIRD_PLACE';
            let x = 0;
            let y = 0;
            let isRightSide = false;
            const isCenter = isWinnerBracket && r === totalRounds;

            if (isThirdPlace) {
                x = 0;
                y = Y_OFFSET * 1.5;
            } else if (isCenter) {
                x = 0;
                y = 0;
            } else {
                const matchesInRound = Math.pow(2, totalRounds - r);
                const halfMatches = matchesInRound / 2;
                isRightSide = m >= halfMatches;
                const xSteps = totalRounds - r;
                x = isRightSide ? xSteps * X_OFFSET : -xSteps * X_OFFSET;
                const localM = isRightSide ? m - halfMatches : m;
                y = (localM - (halfMatches - 1) / 2) * Y_OFFSET * Math.pow(1.6, r - 1);
            }

            return {
                id: match.id,
                type: 'publicMatch',
                position: { x, y },
                data: {
                    homeTeam: match.homeTeam,
                    homeScore: match.homeScore,
                    awayTeam: match.awayTeam,
                    awayScore: match.awayScore,
                    status: match.status,
                    isRightSide,
                    isCenter,
                    isThirdPlace,
                    stageName: getStageName(match.round, match.bracketType)
                }
            };
        });

        const newEdges: Edge[] = [];
        matches.forEach((m: any) => {
            if (m.nextMatchId) {
                const isLive = m.status === 'LIVE' || m.status === 'IN_PROGRESS';
                newEdges.push({
                    id: `e-${m.id}-${m.nextMatchId}`,
                    source: m.id,
                    target: m.nextMatchId,
                    type: 'smoothstep',
                    style: { 
                        stroke: isLive ? '#3b82f6' : 'rgba(255,255,255,0.06)', 
                        strokeWidth: isLive ? 3 : 2,
                        filter: isLive ? 'drop-shadow(0 0 8px rgba(59,130,246,0.3))' : 'none'
                    },
                    animated: isLive
                });
            }
        });

        return { nodes: newNodes, edges: newEdges };
    }, [matches]);

    return (
        <div className="w-full h-full bg-[#0d0f12]">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.3 }}
                proOptions={{ hideAttribution: true }}
                nodesDraggable={false}
                nodesConnectable={false}
                zoomOnScroll={false}
                panOnScroll={true}
                panOnDrag={true}
            >
                <Background color="rgba(255,255,255,0.02)" gap={30} size={1} />
            </ReactFlow>
        </div>
    );
}
