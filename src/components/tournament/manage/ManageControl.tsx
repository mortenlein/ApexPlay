'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, MapPin, Crown, Users, Swords, Trophy, GitBranch } from 'lucide-react';
import PublicBracket from '@/components/PublicBracket';
import { Card, Badge, StatusBadge } from '@/components/ui';
import { EonBridgePanel } from './EonBridgePanel';

interface ManageControlProps {
  tournament: any;
  teams: any[];
  matches: any[];
  onOpenMatchModal: (match: any) => void;
}

const LIVE = ['LIVE', 'IN_PROGRESS'];
const DONE = ['COMPLETED', 'FINISHED'];
const byOrder = (a: any, b: any) => a.round - b.round || a.matchOrder - b.matchOrder;

function stageLabel(match: any, totalRounds: number) {
  if (match.bracketType === 'GRAND_FINAL') return 'Grand Final';
  if (match.bracketType === 'THIRD_PLACE') return '3rd Place';
  if (match.bracketType === 'LOSERS') return `Lower R${match.round}`;
  const fromFinal = totalRounds - match.round;
  if (fromFinal === 0) return 'Final';
  if (fromFinal === 1) return 'Semi-Final';
  if (fromFinal === 2) return 'Quarter-Final';
  return `Round ${match.round}`;
}

function GameRow({ match, totalRounds, onClick }: { match: any; totalRounds: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-sm border border-line bg-field px-3 py-2 text-left transition-all hover:border-line-hover"
    >
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-fg-subtle">{stageLabel(match, totalRounds)}</span>
        <StatusBadge status={match.status} />
      </div>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className={`truncate font-semibold ${match.winnerId && match.winnerId === match.homeTeamId ? 'text-brand' : ''}`}>
          {match.homeTeam?.name || 'TBD'}
        </span>
        <span className="shrink-0 font-mono font-bold tabular-nums text-fg-muted">
          {match.homeScore}:{match.awayScore}
        </span>
        <span className={`truncate text-right font-semibold ${match.winnerId && match.winnerId === match.awayTeamId ? 'text-brand' : ''}`}>
          {match.awayTeam?.name || 'TBD'}
        </span>
      </div>
    </button>
  );
}

function GamesSection({
  title,
  icon,
  matches,
  totalRounds,
  onOpen,
  empty,
}: {
  title: string;
  icon: React.ReactNode;
  matches: any[];
  totalRounds: number;
  onOpen: (m: any) => void;
  empty: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="mds-uppercase-label text-fg-subtle">{title}</h3>
        </div>
        <Badge tone="neutral">{matches.length}</Badge>
      </div>
      {matches.length === 0 ? (
        <p className="rounded-sm border border-dashed border-line px-3 py-2 text-xs text-fg-subtle">{empty}</p>
      ) : (
        <div className="space-y-2">
          {matches.map((m) => (
            <GameRow key={m.id} match={m} totalRounds={totalRounds} onClick={() => onOpen(m)} />
          ))}
        </div>
      )}
    </div>
  );
}

function TeamRosterCard({ team }: { team: any }) {
  const [open, setOpen] = useState(true);
  const players = team.players || [];
  return (
    <div className="rounded-sm border border-line bg-field">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {open ? <ChevronDown size={14} className="shrink-0 text-fg-subtle" /> : <ChevronRight size={14} className="shrink-0 text-fg-subtle" />}
          <span className="truncate text-sm font-semibold">{team.name}</span>
          {team.seed != null && <Badge tone="neutral">#{team.seed}</Badge>}
        </div>
        <span className="shrink-0 text-xs text-fg-subtle">{players.length}</span>
      </button>
      {open && (
        <div className="space-y-1 border-t border-line px-3 py-2">
          {players.length === 0 ? (
            <p className="text-xs text-fg-subtle">No players yet</p>
          ) : (
            players.map((p: any) => (
              <div key={p.id} className="flex items-center gap-2 text-sm">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${p.isOnline ? 'bg-success' : 'bg-line-hover'}`} />
                <span className="flex-1 truncate font-medium">
                  {p.nickname || p.name}
                  {p.isLeader && <Crown size={11} className="ml-1 inline text-warning" />}
                </span>
                {p.countryCode && (
                  <span className="text-[10px] font-semibold uppercase text-fg-subtle">{p.countryCode}</span>
                )}
                <span
                  className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-mono text-[11px] font-bold ${
                    p.seating ? 'bg-brand-soft text-brand' : 'bg-white/5 text-fg-subtle'
                  }`}
                >
                  <MapPin size={10} />
                  {p.seating || '—'}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Single organizer control view: all teams + rosters (left), the interactive bracket
 * (center — drag to pan, scroll to zoom, click a match to edit/update), and the
 * previous/live/next games as a list (right). One screen to run the event.
 */
export function ManageControl({ tournament, teams, matches, onOpenMatchModal }: ManageControlProps) {
  const winners = matches.filter((m) => m.bracketType === 'WINNERS');
  const totalRounds = winners.length ? Math.max(...winners.map((m) => m.round)) : 0;

  const live = matches.filter((m) => LIVE.includes(m.status)).sort(byOrder);
  const upNext = matches
    .filter((m) => !LIVE.includes(m.status) && !DONE.includes(m.status))
    .sort(byOrder);
  const previous = matches
    .filter((m) => DONE.includes(m.status))
    .sort((a, b) => b.round - a.round || b.matchOrder - a.matchOrder);

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Teams & rosters */}
      <aside className="col-span-12 space-y-3 lg:col-span-3">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-brand" />
          <h2 className="mds-uppercase-label text-fg-subtle">Teams &amp; rosters</h2>
          <Badge tone="neutral">{teams.length}</Badge>
        </div>
        <div className="space-y-2">
          {teams.length === 0 ? (
            <p className="rounded-sm border border-dashed border-line px-3 py-3 text-xs text-fg-subtle">
              No teams registered yet.
            </p>
          ) : (
            teams.map((t: any) => <TeamRosterCard key={t.id} team={t} />)
          )}
        </div>
      </aside>

      {/* Bracket */}
      <section className="col-span-12 lg:col-span-6">
        <Card className="flex h-[640px] flex-col overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="flex items-center gap-2">
              <GitBranch size={16} className="text-brand" />
              <h2 className="text-sm font-bold">Bracket</h2>
            </div>
            <span className="hidden text-xs text-fg-subtle sm:block">drag to pan · scroll to zoom · click a match to update</span>
          </div>
          <div className="relative flex-1">
            {matches.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <Trophy size={26} className="text-fg-subtle" />
                <p className="text-sm text-fg-muted">No bracket yet — generate it from Matches once teams are seeded.</p>
              </div>
            ) : (
              <PublicBracket
                tournamentId={tournament.id}
                matches={matches}
                onMatchClick={(id: string) => {
                  const m = matches.find((mm) => mm.id === id);
                  if (m) onOpenMatchModal(m);
                }}
              />
            )}
          </div>
        </Card>
      </section>

      {/* Games queue + live source */}
      <aside className="col-span-12 space-y-5 lg:col-span-3">
        <EonBridgePanel tournamentId={tournament.id} />

        <div className="flex items-center gap-2">
          <Swords size={16} className="text-brand" />
          <h2 className="mds-uppercase-label text-fg-subtle">Games</h2>
        </div>
        <GamesSection
          title="Live now"
          icon={<span className="h-2 w-2 rounded-full bg-danger" />}
          matches={live}
          totalRounds={totalRounds}
          onOpen={onOpenMatchModal}
          empty="No live matches."
        />
        <GamesSection
          title="Up next"
          icon={<span className="h-2 w-2 rounded-full bg-warning" />}
          matches={upNext}
          totalRounds={totalRounds}
          onOpen={onOpenMatchModal}
          empty="Nothing queued."
        />
        <GamesSection
          title="Completed"
          icon={<span className="h-2 w-2 rounded-full bg-success" />}
          matches={previous}
          totalRounds={totalRounds}
          onOpen={onOpenMatchModal}
          empty="No results yet."
        />
      </aside>
    </div>
  );
}
