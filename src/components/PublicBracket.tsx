"use client";

import React, { useMemo } from 'react';
import Image from 'next/image';
import ReactFlow, { Background, Edge, Node, Handle, Position } from 'reactflow';
import 'reactflow/dist/style.css';
import { Trophy, Activity, Zap } from 'lucide-react';

const PublicMatchNode = ({ data }: any) => {
    const isCenter = data.isCenter;
    const isThirdPlace = data.isThirdPlace;
    const scale = data.scale || 1;

    return (
        <div 
            onClick={() => data.onMatchClick?.(data.id)}
            style={{ 
                transform: `scale(${scale})`,
                transformOrigin: 'center',
                zIndex: isCenter ? 100 : 1
            }}
            className={`mds-card relative p-0 min-w-[280px] transition-all duration-500 group cursor-pointer overflow-visible ${
            isCenter && !isThirdPlace 
            ? 'border-[var(--mds-action)] shadow-[0_0_30px_rgba(var(--mds-action-rgb),0.2)] ring-8 ring-[var(--mds-action)]/5' 
            : 'border-[var(--mds-border)] hover:border-[var(--mds-action)]/40'
        }`}>
            {/* Handles - Hidden but necessary for connections */}
            <Handle type="target" position={data.isRightSide ? Position.Right : Position.Left} style={{ opacity: 0 }} />
            <Handle type="source" position={data.isRightSide ? Position.Left : Position.Right} style={{ opacity: 0 }} />
            
            {data.stageName && (
                <div className={`absolute -top-3 left-6 px-3 py-1 mds-badge font-black uppercase text-[8px] tracking-[0.2em] z-10 ${
                    isCenter ? 'bg-[var(--mds-action)] text-white shadow-[0_0_15px_rgba(var(--mds-action-rgb),0.4)] border-none' : 'bg-[var(--mds-input)] text-[var(--mds-text-primary)] border-[var(--mds-border)]'
                }`}>
                    {data.stageName}
                </div>
            )}

            <div className="flex flex-col p-4 gap-2">
                {/* Home Team */}
                <div className="flex items-center justify-between h-11 px-4 rounded-mds-comfortable bg-[var(--mds-input)]/40 border border-transparent group-hover:bg-[var(--mds-input)]/60 group-hover:border-[var(--mds-action)]/20 transition-all">
                    <div className="flex items-center gap-4 overflow-hidden">
                        <div className="w-7 h-7 rounded-mds-comfortable bg-[var(--mds-page)] flex items-center justify-center shrink-0 border border-[var(--mds-border)] overflow-hidden relative shadow-mds-whisper">
                            {data.homeTeam?.logoUrl ? (
                                <Image src={data.homeTeam.logoUrl} alt="" fill className="object-contain p-1 grayscale group-hover:grayscale-0 transition-all" />
                            ) : (
                                <Trophy size={14} className="text-[var(--mds-text-muted)]" />
                            )}
                        </div>
                        <span className="truncate font-brand text-xs font-bold text-[var(--mds-text-primary)] tracking-tight">
                            {data.homeTeam?.name || 'INITIALIZING...'}
                        </span>
                    </div>
                    <span className={`font-brand text-lg font-black tabular-nums transition-all ${data.homeScore > data.awayScore ? 'text-[var(--mds-action)]' : 'opacity-20'}`}>
                        {data.homeScore}
                    </span>
                </div>

                {/* Away Team */}
                <div className="flex items-center justify-between h-11 px-4 rounded-mds-comfortable bg-[var(--mds-input)]/40 border border-transparent group-hover:bg-[var(--mds-input)]/60 group-hover:border-[var(--mds-action)]/20 transition-all">
                    <div className="flex items-center gap-4 overflow-hidden">
                        <div className="w-7 h-7 rounded-mds-comfortable bg-[var(--mds-page)] flex items-center justify-center shrink-0 border border-[var(--mds-border)] overflow-hidden relative shadow-mds-whisper">
                             {data.awayTeam?.logoUrl ? (
                                <Image src={data.awayTeam.logoUrl} alt="" fill className="object-contain p-1 grayscale group-hover:grayscale-0 transition-all" />
                            ) : (
                                <Trophy size={14} className="text-[var(--mds-text-muted)]" />
                            )}
                        </div>
                        <span className="truncate font-brand text-xs font-bold text-[var(--mds-text-primary)] tracking-tight">
                            {data.awayTeam?.name || 'INITIALIZING...'}
                        </span>
                    </div>
                    <span className={`font-brand text-lg font-black tabular-nums transition-all ${data.awayScore > data.homeScore ? 'text-[var(--mds-action)]' : 'opacity-20'}`}>
                        {data.awayScore}
                    </span>
                </div>
            </div>

            {data.status === 'LIVE' && (
                <div className="absolute -right-2 -top-2 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-[var(--mds-red)] animate-pulse shadow-[0_0_8px_var(--mds-red)]" />
                </div>
            )}
        </div>
    );
};

/**
 * Left-to-right layout for double elimination: winners bracket on top, losers bracket below,
 * grand final to the right. Solid edges follow winners advancement (nextMatchId); faint dashed
 * red edges show the losers drop (loserNextMatchId).
 */
function buildDoubleEliminationLayout(matches: any[], onMatchClick?: (id: string) => void) {
    const COL_W = 340;
    const UNIT_Y = 150;

    const wb = matches.filter((m) => m.bracketType === 'WINNERS');
    const lb = matches.filter((m) => m.bracketType === 'LOSERS');
    const gf = matches.filter((m) => m.bracketType === 'GRAND_FINAL');
    const tp = matches.filter((m) => m.bracketType === 'THIRD_PLACE');

    const k = wb.length ? Math.max(...wb.map((m) => m.round)) : 0;
    const lbFinalRound = lb.length ? Math.max(...lb.map((m) => m.round)) : 0;

    const wbBandH = Math.pow(2, Math.max(0, k - 1)) * UNIT_Y;
    const lbBandH = Math.pow(2, Math.max(0, k - 2)) * UNIT_Y;
    const lbYBase = wbBandH + 200;

    const lbCounts: Record<number, number> = {};
    lb.forEach((m) => { lbCounts[m.round] = (lbCounts[m.round] || 0) + 1; });

    const makeNode = (m: any, x: number, y: number, stageName: string, scale = 1): Node => ({
        id: m.id,
        type: 'publicMatch',
        position: { x, y },
        data: {
            id: m.id,
            homeTeam: m.homeTeam,
            homeScore: m.homeScore,
            awayTeam: m.awayTeam,
            awayScore: m.awayScore,
            status: m.status,
            isRightSide: false,
            isCenter: false,
            isThirdPlace: m.bracketType === 'THIRD_PLACE',
            stageName,
            scale,
            onMatchClick,
        },
    });

    const nodes: Node[] = [];

    wb.forEach((m) => {
        const x = (m.round - 1) * COL_W;
        const y = (m.matchOrder + 0.5) * Math.pow(2, m.round - 1) * UNIT_Y;
        nodes.push(makeNode(m, x, y, m.round === k ? 'Winners Final' : `WB Round ${m.round}`));
    });

    lb.forEach((m) => {
        const count = lbCounts[m.round] || 1;
        const x = (m.round - 1) * COL_W;
        const y = lbYBase + (m.matchOrder + 0.5) * (lbBandH / count);
        nodes.push(makeNode(m, x, y, m.round === lbFinalRound ? 'Losers Final' : `LB Round ${m.round}`));
    });

    const maxCol = Math.max(k, lbFinalRound);
    const gfY = (wbBandH / 2 + lbYBase + lbBandH / 2) / 2 - 60;
    gf.forEach((m) => {
        nodes.push(makeNode(m, maxCol * COL_W, gfY + m.matchOrder * 220, m.matchOrder === 1 ? 'Bracket Reset' : 'Grand Final', 1.15));
    });

    tp.forEach((m) => {
        nodes.push(makeNode(m, Math.max(0, k - 1) * COL_W, lbYBase + lbBandH + 220, '3rd Place'));
    });

    const edges: Edge[] = [];
    matches.forEach((m) => {
        const isLive = m.status === 'LIVE' || m.status === 'IN_PROGRESS';
        if (m.nextMatchId) {
            edges.push({
                id: `w-${m.id}-${m.nextMatchId}`,
                source: m.id,
                target: m.nextMatchId,
                type: 'smoothstep',
                style: { stroke: isLive ? 'var(--mds-action)' : 'var(--mds-border)', strokeWidth: isLive ? 3 : 2, opacity: isLive ? 1 : 0.45 },
                animated: isLive,
            });
        }
        if (m.loserNextMatchId) {
            edges.push({
                id: `l-${m.id}-${m.loserNextMatchId}`,
                source: m.id,
                target: m.loserNextMatchId,
                type: 'smoothstep',
                style: { stroke: 'var(--mds-red)', strokeWidth: 1.5, opacity: 0.22, strokeDasharray: '4 4' },
            });
        }
    });

    return { nodes, edges };
}

export default function PublicBracket({ tournamentId, matches, onMatchClick }: { tournamentId: string, matches: any[], onMatchClick?: (id: string) => void }) {
    // Memoize nodeTypes to avoid React Flow warnings
    const nodeTypes = useMemo(() => ({ publicMatch: PublicMatchNode }), []);

    const { nodes, edges } = useMemo(() => {
        if (!Array.isArray(matches) || matches.length === 0) return { nodes: [], edges: [] };

        // Double elimination uses a dedicated left-to-right layout (winners top, losers below).
        if (matches.some((m) => m.bracketType === 'LOSERS')) {
            return buildDoubleEliminationLayout(matches, onMatchClick);
        }

        const X_OFFSET = 500;
        const Y_OFFSET = 280;
        const winnersMatches = matches.filter(m => m.bracketType === 'WINNERS');
        const totalRounds = winnersMatches.length > 0 ? Math.max(...winnersMatches.map(m => m.round)) : 0;

        const getStageName = (round: number, bracketType: string): string => {
            if (bracketType === 'THIRD_PLACE') return '3rd Place Match';
            const stepsFromFinal = totalRounds - round;
            switch (stepsFromFinal) {
                case 0: return 'Grand Finals';
                case 1: return 'Semi Finals';
                case 2: return 'Quarter Finals';
                default: 
                    return `Round ${round}`;
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
            
            const stepsFromFinal = totalRounds - r;
            let scale = 1.0;
            if (isWinnerBracket) {
                if (stepsFromFinal === 0) scale = 1.8;
                else if (stepsFromFinal === 1) scale = 1.4;
                else if (stepsFromFinal === 2) scale = 1.2;
            }

            if (isThirdPlace) {
                x = 0;
                y = Y_OFFSET * 1.8;
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
                y = (localM - (halfMatches - 1) / 2) * Y_OFFSET * Math.pow(2, r - 1);
            }

            return {
                id: match.id,
                type: 'publicMatch',
                position: { x, y },
                data: {
                    id: match.id,
                    homeTeam: match.homeTeam,
                    homeScore: match.homeScore,
                    awayTeam: match.awayTeam,
                    awayScore: match.awayScore,
                    status: match.status,
                    isRightSide,
                    isCenter,
                    isThirdPlace,
                    stageName: getStageName(match.round, match.bracketType),
                    scale,
                    onMatchClick
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
                        stroke: isLive ? 'var(--mds-action)' : 'var(--mds-border)', 
                        strokeWidth: isLive ? 4 : 2,
                        opacity: isLive ? 1 : 0.4
                    },
                    animated: isLive
                });
            }
        });

        return { nodes: newNodes, edges: newEdges };
    }, [matches, onMatchClick]);

    return (
        <div className="w-full h-full bg-[var(--mds-page)]">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                proOptions={{ hideAttribution: true }}
                nodesDraggable={false}
                nodesConnectable={false}
                zoomOnScroll={true}
                panOnScroll={false}
                panOnDrag={true}
                selectionOnDrag={false}
                minZoom={0.1}
                maxZoom={1.5}
            >
                <Background color="var(--mds-border)" gap={40} size={1} />
            </ReactFlow>
        </div>
    );
}
