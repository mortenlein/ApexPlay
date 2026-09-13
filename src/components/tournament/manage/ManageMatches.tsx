'use client';

import { byPlayOrder, isDone, isLive } from '@/lib/match-status';
import React from 'react';
import { Zap, RefreshCw, Gamepad2, Settings2 } from 'lucide-react';
import { Badge, StatusBadge } from '@/components/ui';
import { stageLabel, totalRoundsOf } from './ManageControl';

interface ManageMatchesProps {
  matches: any[];
  onGenerateMatches: () => void;
  generating: boolean;
  onOpenMatchModal: (match: any) => void;
  teamsCount: number;
}

/** One side of the card: the name owns the row and wraps, the score is pinned right. */
function Side({ name, score, won, dim }: { name: string; score: number; won: boolean; dim: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className={`mds-name text-sm ${won ? 'text-fg' : dim ? 'text-fg-subtle' : 'text-fg-muted'}`}>
        {name}
      </span>
      <span className={`mds-numeric shrink-0 text-lg font-bold ${won ? 'text-brand' : 'text-fg-subtle'}`}>
        {score}
      </span>
    </div>
  );
}

export const ManageMatches: React.FC<ManageMatchesProps> = ({
  matches,
  onGenerateMatches,
  generating,
  onOpenMatchModal,
  teamsCount,
}) => {
  const completedMatches = matches.filter((m) => isDone(m.status)).length;
  const liveMatches = matches.filter((m) => isLive(m.status)).length;
  const totalRounds = totalRoundsOf(matches);
  // Play order, so the list reads the way the event runs rather than the way rows were written.
  const ordered = [...matches].sort(byPlayOrder);

  return (
    <section className="mds-card p-0 overflow-hidden">
      <header className="flex flex-col gap-4 border-b border-[var(--mds-border)] bg-[var(--mds-input)]/20 px-6 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Tournament Matches</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{matches.length} total</Badge>
            {liveMatches > 0 && <Badge tone="live">{liveMatches} live</Badge>}
            <Badge tone="done">{completedMatches} completed</Badge>
          </div>
        </div>
        <button
          onClick={onGenerateMatches}
          disabled={generating || teamsCount < 2 || matches.length > 0}
          className="mds-btn-primary h-10 shrink-0 gap-2 px-5 text-sm font-bold disabled:opacity-30"
        >
          {generating ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
          Generate bracket
        </button>
      </header>

      <div className="p-6">
        {matches.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--mds-border)] py-20 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--mds-border)] bg-[var(--mds-input)]">
              <Gamepad2 size={28} className="text-[var(--mds-text-subtle)]" />
            </div>
            <h3 className="text-base font-bold">No bracket yet</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[var(--mds-text-muted)]">
              {teamsCount < 2
                ? 'Register at least 2 teams, then generate the bracket to create the first round.'
                : 'Generate the bracket to create the first round from the seeded teams.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {ordered.map((m: any) => {
              const done = isDone(m.status);
              const homeWon = done && m.homeScore > m.awayScore;
              const awayWon = done && m.awayScore > m.homeScore;
              return (
                <button
                  key={m.id}
                  onClick={() => onOpenMatchModal(m)}
                  data-testid={`match-card-${m.id}`}
                  className={`group flex flex-col overflow-hidden rounded-lg border text-left transition-all hover:bg-[var(--mds-card-hover)] ${
                    isLive(m.status)
                      ? 'border-[var(--mds-red)]/40'
                      : 'border-[var(--mds-border)] hover:border-[var(--mds-action)]/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 border-b border-[var(--mds-border)]/60 bg-[var(--mds-input)]/20 px-4 py-2.5">
                    <span className="mds-uppercase-label text-[var(--mds-text-subtle)]">
                      {stageLabel(m, totalRounds)}
                    </span>
                    <StatusBadge status={m.status} />
                  </div>

                  <div className="space-y-2 px-4 py-4">
                    <Side name={m.homeTeam?.name || 'TBD'} score={m.homeScore} won={homeWon} dim={!m.homeTeam} />
                    <Side name={m.awayTeam?.name || 'TBD'} score={m.awayScore} won={awayWon} dim={!m.awayTeam} />
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-2 border-t border-[var(--mds-border)] px-4 py-2.5">
                    <span className="text-xs text-[var(--mds-text-subtle)]">
                      Best of {m.bestOf || 1}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--mds-action)] opacity-0 transition-opacity group-hover:opacity-100">
                      <Settings2 size={13} /> Edit
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
