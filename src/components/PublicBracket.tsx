"use client";

import React, { useMemo } from 'react';
import Image from 'next/image';
import ReactFlow, { Background, Edge, Node, Handle, Position } from 'reactflow';
import 'reactflow/dist/style.css';
import { Trophy } from 'lucide-react';
import { isDone, isLive } from '@/lib/match-status';
import { isDoubleElimination, slotLabel, stageName } from './tournament/match-labels';

const COL_W = 320;
const UNIT_Y = 176;

function TeamRow({ team, label, score, scoreClass }: { team: any; label: string; score: number; scoreClass: string }) {
    return (
        <div className="flex items-center gap-3 rounded-sm bg-field px-3 py-2">
            <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-sm border border-line bg-page">
                {team?.logoUrl ? (
                    <Image src={team.logoUrl} alt="" fill className="object-contain p-0.5" />
                ) : (
                    <Trophy size={12} className="absolute inset-0 m-auto text-fg-subtle" />
                )}
            </div>
            <span className={`mds-name mds-clamp-2 min-w-0 flex-1 text-xs leading-snug ${team?.name ? 'text-fg' : 'text-fg-subtle'}`}>
                {label}
            </span>
            <span className={`mds-numeric tabular-nums text-base font-bold ${scoreClass}`}>
                {score}
            </span>
        </div>
    );
}

function scoreTone(decided: boolean, score: number, other: number) {
    if (!decided) return 'text-fg-subtle';
    return score > other ? 'text-brand' : 'opacity-20';
}

const PublicMatchNode = ({ data }: any) => {
    const live = isLive(data.status);

    return (
        <div
            onClick={() => data.onMatchClick?.(data.id)}
            className={`mds-card w-[260px] cursor-pointer p-2 ${
                live ? 'border-danger' : data.isFinal ? 'border-brand' : 'border-line hover:border-brand'
            }`}
        >
            {/* Handles — invisible, but the edges attach to them. */}
            <Handle type="target" position={data.isRightSide ? Position.Right : Position.Left} style={{ opacity: 0 }} />
            <Handle type="source" position={data.isRightSide ? Position.Left : Position.Right} style={{ opacity: 0 }} />

            <div className="flex items-center justify-between gap-2 px-1 pb-2 pt-1">
                <span className="mds-uppercase-label text-[10px]">{data.stageName}</span>
                {live ? (
                    <span className="mds-uppercase-label flex items-center gap-1.5 text-[10px] text-danger">
                        <span className="h-1.5 w-1.5 rounded-full bg-danger animate-pulse" />
                        Live
                    </span>
                ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
                {/* Only a decided match marks a winner; an unplayed 0 stays quiet. */}
                <TeamRow
                    team={data.homeTeam}
                    label={data.homeLabel}
                    score={data.homeScore}
                    scoreClass={scoreTone(data.decided, data.homeScore, data.awayScore)}
                />
                <TeamRow
                    team={data.awayTeam}
                    label={data.awayLabel}
                    score={data.awayScore}
                    scoreClass={scoreTone(data.decided, data.awayScore, data.homeScore)}
                />
            </div>
        </div>
    );
};

/**
 * One left-to-right layout for every bracket: winners rounds as columns, the losers bracket as a
 * band underneath, the grand final to the right of both. (Single elimination used to render
 * mirrored, with the final blown up 1.8x in the middle — which fitView then shrank until no team
 * name on the canvas was readable.)
 */
function buildLayout(matches: any[], onMatchClick?: (id: string) => void) {
    const de = isDoubleElimination(matches);
    const wb = matches.filter((m) => (m.bracketType || 'WINNERS').toUpperCase() === 'WINNERS');
    const lb = matches.filter((m) => m.bracketType === 'LOSERS');
    const gf = matches.filter((m) => m.bracketType === 'GRAND_FINAL');
    const tp = matches.filter((m) => m.bracketType === 'THIRD_PLACE');

    const wbRounds = wb.length ? Math.max(...wb.map((m) => m.round)) : 0;
    const lbFinalRound = lb.length ? Math.max(...lb.map((m) => m.round)) : 0;
    const wbBandH = Math.pow(2, Math.max(0, wbRounds - 1)) * UNIT_Y;
    const lbBandH = Math.pow(2, Math.max(0, wbRounds - 2)) * UNIT_Y;
    const lbYBase = wbBandH + 160;

    const lbCounts: Record<number, number> = {};
    lb.forEach((m) => { lbCounts[m.round] = (lbCounts[m.round] || 0) + 1; });

    const makeNode = (m: any, x: number, y: number, isFinal = false): Node => ({
        id: m.id,
        type: 'publicMatch',
        position: { x, y },
        data: {
            id: m.id,
            homeTeam: m.homeTeam,
            homeLabel: slotLabel(m, 'HOME', matches),
            homeScore: m.homeScore,
            awayTeam: m.awayTeam,
            awayLabel: slotLabel(m, 'AWAY', matches),
            awayScore: m.awayScore,
            status: m.status,
            decided: isDone(m.status),
            isRightSide: false,
            isFinal,
            stageName: stageName(m, matches, { short: true }),
            onMatchClick,
        },
    });

    const nodes: Node[] = [];

    wb.forEach((m) => {
        const x = (m.round - 1) * COL_W;
        const y = (m.matchOrder + 0.5) * Math.pow(2, m.round - 1) * UNIT_Y;
        nodes.push(makeNode(m, x, y, !de && m.round === wbRounds));
    });

    lb.forEach((m) => {
        const count = lbCounts[m.round] || 1;
        const x = (m.round - 1) * COL_W;
        const y = lbYBase + (m.matchOrder + 0.5) * (lbBandH / count);
        nodes.push(makeNode(m, x, y));
    });

    const gfColumn = Math.max(wbRounds, lbFinalRound);
    gf.forEach((m) => {
        const y = (wbBandH / 2 + lbYBase + lbBandH / 2) / 2 + m.matchOrder * 200;
        nodes.push(makeNode(m, gfColumn * COL_W, y, m.matchOrder !== 1));
    });

    tp.forEach((m) => {
        // Under the bracket it belongs to, not floating in a quadrant of its own.
        nodes.push(makeNode(m, Math.max(0, wbRounds - 1) * COL_W, (de ? lbYBase + lbBandH : wbBandH) + 40));
    });

    const edges: Edge[] = [];
    matches.forEach((m) => {
        const live = isLive(m.status);
        if (m.nextMatchId) {
            edges.push({
                id: `e-${m.id}-${m.nextMatchId}`,
                source: m.id,
                target: m.nextMatchId,
                type: 'smoothstep',
                style: {
                    stroke: live ? 'var(--mds-action)' : 'var(--mds-border)',
                    strokeWidth: live ? 3 : 2,
                    opacity: live ? 1 : 0.5,
                },
                animated: live,
            });
        }
        if (m.loserNextMatchId) {
            edges.push({
                id: `l-${m.id}-${m.loserNextMatchId}`,
                source: m.id,
                target: m.loserNextMatchId,
                type: 'smoothstep',
                style: { stroke: 'var(--mds-red)', strokeWidth: 1.5, opacity: 0.3, strokeDasharray: '4 4' },
            });
        }
    });

    return { nodes, edges };
}

export default function PublicBracket({ matches, onMatchClick }: { tournamentId: string, matches: any[], onMatchClick?: (id: string) => void }) {
    // Memoized so React Flow doesn't warn about a new nodeTypes object on every render.
    const nodeTypes = useMemo(() => ({ publicMatch: PublicMatchNode }), []);

    const { nodes, edges } = useMemo(() => {
        if (!Array.isArray(matches) || matches.length === 0) return { nodes: [], edges: [] };
        return buildLayout(matches, onMatchClick);
    }, [matches, onMatchClick]);

    return (
        <div className="h-full w-full bg-page">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.06, maxZoom: 1 }}
                proOptions={{ hideAttribution: true }}
                nodesDraggable={false}
                nodesConnectable={false}
                zoomOnScroll={true}
                panOnScroll={false}
                panOnDrag={true}
                selectionOnDrag={false}
                minZoom={0.4}
                maxZoom={1.5}
            >
                <Background color="var(--mds-border)" gap={40} size={1} />
            </ReactFlow>
        </div>
    );
}
