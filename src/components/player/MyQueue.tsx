'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Radio, Swords, Clock, Hourglass, Flag, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button, Card, StatusBadge } from '@/components/ui';
import { isCalled, isLive } from '@/lib/match-status';
import { clientApi } from '@/lib/client-api';

interface NextMatch {
  id: string;
  round: number;
  status: string;
  bracketType: string;
  bestOf: number;
  opponent: string;
  youAreHome: boolean;
  hasOpponent: boolean;
}

interface QueueEntry {
  tournamentId: string;
  tournamentName: string;
  game: string;
  teamName: string;
  state: 'SCHEDULED' | 'AWAITING_DRAW' | 'OUT' | 'NO_BRACKET';
  matchesAhead: number | null;
  totalPending: number;
  nextMatch: NextMatch | null;
}

function stageLabel(bracketType: string, round: number) {
  switch (bracketType) {
    case 'GRAND_FINAL':
      return 'Grand Final';
    case 'THIRD_PLACE':
      return '3rd Place';
    case 'LOSERS':
      return `Lower Bracket · R${round}`;
    default:
      return `Round ${round}`;
  }
}

/**
 * What the player should actually do, in priority order: a live or called match always wins
 * over the queue position — "3 matches ahead" is wrong and alarming once you've been called.
 */
function QueuePosition({ entry }: { entry: QueueEntry }) {
  const m = entry.nextMatch!;
  const status = (m.status || '').toUpperCase();
  if (isLive(status)) {
    return (
      <div className="flex items-center gap-2 text-danger font-bold">
        <Radio size={16} className="animate-pulse" />
        Live now — get to your station
      </div>
    );
  }
  if (isCalled(status)) {
    return (
      <div className="flex items-center gap-2 text-success font-bold">
        <Flag size={16} />
        You&apos;re up — go to your station
      </div>
    );
  }
  if (entry.matchesAhead === 0) {
    return (
      <div className="flex items-center gap-2 text-success font-bold">
        <Flag size={16} />
        You&apos;re up next
      </div>
    );
  }
  const n = entry.matchesAhead ?? 0;
  return (
    <div className="flex items-center gap-2 text-fg-muted font-semibold">
      <Hourglass size={16} className="text-warning" />
      {n} {n === 1 ? 'match' : 'matches'} ahead of you
    </div>
  );
}

function QueueHeading() {
  return (
    <div className="flex items-center gap-2">
      <Swords size={16} className="text-brand" />
      <h2 className="text-sm font-brand font-bold uppercase tracking-wide">Your queue</h2>
    </div>
  );
}

export function MyQueue() {
  const { data, isLoading, error, refetch, isFetching } = useQuery<{ queue: QueueEntry[] }>({
    queryKey: ['me-queue'],
    queryFn: () => clientApi.getQueue(),
    refetchInterval: 15000,
  });

  // A silently missing queue reads as "you have no matches", which is the one thing it must
  // never imply. Say it failed and offer a retry instead.
  if (error) {
    return (
      <section className="space-y-4">
        <QueueHeading />
        <Card className="flex flex-wrap items-center justify-between gap-3 border-danger/30">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-danger" />
            <p className="text-sm font-semibold">Couldn&apos;t load your queue</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : undefined} />
            Retry
          </Button>
        </Card>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="space-y-4">
        <QueueHeading />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="space-y-3" aria-busy="true">
            <p className="text-xs text-fg-subtle">Loading…</p>
            <div className="h-3 w-1/3 animate-pulse rounded-sm bg-white/5" />
            <div className="h-5 w-2/3 animate-pulse rounded-sm bg-white/5" />
            <div className="h-3 w-1/2 animate-pulse rounded-sm bg-white/5" />
          </Card>
        </div>
      </section>
    );
  }

  const scheduled = (data?.queue ?? []).filter((q) => q.state === 'SCHEDULED');
  if (scheduled.length === 0) {
    return null; // The dashboard's own sections cover the empty case.
  }

  return (
    <section className="space-y-4">
      <QueueHeading />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {scheduled.map((entry) => {
          const m = entry.nextMatch!;
          return (
            <Card key={entry.tournamentId} className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="mds-uppercase-label text-fg-subtle">{entry.tournamentName}</p>
                  <p className="mt-1 text-[11px] font-semibold text-brand">
                    {stageLabel(m.bracketType, m.round)} · BO{m.bestOf}
                  </p>
                </div>
                <StatusBadge status={m.status} />
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-fg-subtle text-sm">{entry.teamName}</span>
                <span className="text-fg-subtle text-xs">vs</span>
                <span className="text-lg font-brand font-bold">
                  {m.hasOpponent ? m.opponent : 'TBD'}
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-line pt-3">
                <QueuePosition entry={entry} />
                <Link
                  href={`/tournaments/${entry.tournamentId}`}
                  className="text-xs font-semibold text-brand hover:underline flex items-center gap-1"
                >
                  <Clock size={13} />
                  View bracket
                </Link>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
