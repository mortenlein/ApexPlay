'use client';

import { byPlayOrder, isCalled, isDone, isLive } from '@/lib/match-status';
import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Users, Sword, Zap, RefreshCw, Copy, Check, ArrowRight, Bell } from 'lucide-react';
import { InlineNotice } from '@/components/workspace/WorkspaceChrome';
import { Badge, StatusBadge } from '@/components/ui';
import { stageLabel, totalRoundsOf } from './ManageControl';

interface ManageOverviewProps {
  tournament: any;
  teams: any[];
  matches: any[];
  activity: any[];
  notifications: any[];
  onGenerateMatches: () => void;
  generating: boolean;
  onOpenMatchModal: (match: any) => void;
  onSetTab: (tab: string) => void;
  onCopyPublicLink: () => void;
}

/** A copyable URL row: label, the link itself, and one button that confirms it copied. */
function LinkField({
  label,
  copyLabel,
  url,
  onCopy,
}: {
  label: string;
  /** Spelled out rather than derived from `label`: a lower-cased English phrase is not a
      translation, and several languages do not lower-case the way English does. */
  copyLabel: string;
  url: string;
  onCopy?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <p className="mds-uppercase-label">{label}</p>
      <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-[var(--mds-border)] bg-[var(--mds-page)] px-3 py-2">
        <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-[var(--mds-action)]">{url}</code>
        <button
          type="button"
          aria-label={copyLabel}
          onClick={() => {
            if (onCopy) onCopy();
            else navigator.clipboard?.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-[var(--mds-border)] bg-white/5 text-[var(--mds-text-primary)] transition-colors hover:bg-white/10"
        >
          {copied ? <Check size={14} className="text-[var(--mds-green)]" /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
}

export const ManageOverview: React.FC<ManageOverviewProps> = ({
  tournament,
  teams,
  matches,
  activity,
  notifications,
  onGenerateMatches,
  generating,
  onOpenMatchModal,
  onSetTab,
  onCopyPublicLink,
}) => {
  const t = useTranslations('organizer.overview');
  const tConfirm = useTranslations('organizer.confirm');
  const tCommon = useTranslations('common');
  const tStage = useTranslations('stage');
  const liveMatches = matches.filter((match) => isLive(match.status)).length;
  const waitingMatches = matches.filter((match) => isCalled(match.status)).length;
  const completedMatches = matches.filter((match) => isDone(match.status)).length;
  const totalRounds = totalRoundsOf(matches);
  const bracketStatus = t(
    matches.length === 0
      ? 'statusNotGenerated'
      : liveMatches > 0
        ? 'statusLiveRunning'
        : waitingMatches > 0
          ? 'statusPlayersJoining'
          : 'statusReadyNextRound'
  );

  const stats = [
    { label: t('statTeams'), value: teams.length, icon: Users, color: 'var(--mds-action)' },
    { label: t('statMatches'), value: matches.length, icon: Sword, color: 'var(--mds-red)' },
    { label: t('statLive'), value: liveMatches, icon: Zap, color: 'var(--mds-red)' },
    { label: t('statWaiting'), value: waitingMatches, icon: Bell, color: 'var(--mds-amber)' },
    { label: t('statPlayed'), value: completedMatches, icon: Check, color: 'var(--mds-green)' },
  ];

  const timeline = [...activity, ...notifications]
    .sort((a: any, b: any) => new Date(b.createdAt || b.timestamp).getTime() - new Date(a.createdAt || a.timestamp).getTime())
    .slice(0, 6);

  // What the organizer would actually look at here: the games in play order, not "first four rows".
  // Whatever is still to play comes first; once everything is played, the last results stand in.
  const ordered = [...matches].sort(byPlayOrder);
  const unplayed = ordered.filter((match) => !isDone(match.status));
  const recent = (unplayed.length > 0 ? unplayed : ordered.reverse()).slice(0, 4);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="space-y-6 lg:col-span-8">
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {stats.map((stat) => (
            <div key={stat.label} className="mds-card flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="mds-uppercase-label">{stat.label}</p>
                <p className="mds-numeric mt-1 text-xl font-bold">{stat.value}</p>
              </div>
              <stat.icon size={16} className="shrink-0 opacity-50" style={{ color: stat.color }} />
            </div>
          ))}
        </section>

        {tournament.rosterLocked ? (
          <InlineNotice
            tone="warning"
            title={t('lockTitle')}
            description={t('lockHint')}
          />
        ) : null}

        <div className="mds-card p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold tracking-tight">{t('progressTitle')}</h2>
              <p className="mt-0.5 text-xs text-[var(--mds-text-muted)]">
                {matches.length === 0
                  ? t('progressNone')
                  : t('progressCount', { played: completedMatches, total: matches.length, status: bracketStatus })}
              </p>
            </div>
            <button
              onClick={() => {
                const message = tConfirm(
                  matches.length > 0 ? 'regenerateBracketOverview' : 'generateBracketOverview'
                );
                if (!window.confirm(message)) {
                  return;
                }
                onGenerateMatches();
              }}
              disabled={generating || teams.length < 2 || (matches.length > 0 && tournament.rosterLocked)}
              className="mds-btn-primary h-10 gap-2 px-5 text-sm font-bold disabled:opacity-30"
            >
              {generating ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
              {t(matches.length > 0 ? 'regenerate' : 'generate')}
            </button>
          </div>

          {matches.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--mds-border)] py-14 text-center">
              <p className="text-sm font-bold">{t('emptyTitle')}</p>
              <p className="mt-1 text-sm text-[var(--mds-text-muted)]">{t('emptyHint')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="mds-uppercase-label">{t(unplayed.length > 0 ? 'nextUp' : 'lastResults')}</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {recent.map((match: any) => (
                  <button
                    key={match.id}
                    onClick={() => onOpenMatchModal(match)}
                    className="group flex items-start justify-between gap-3 rounded-lg border border-[var(--mds-border)] bg-[var(--mds-input)]/20 p-4 text-left transition-all hover:border-[var(--mds-action)]/40"
                  >
                    <div className="min-w-0">
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="mds-uppercase-label text-[var(--mds-text-subtle)]">
                          {stageLabel(match, totalRounds, tStage)}
                        </span>
                        <StatusBadge status={match.status} />
                      </div>
                      <p className="mds-name text-sm">{match.homeTeam?.name || tCommon('tbd')}</p>
                      <p className="mds-name text-sm">{match.awayTeam?.name || tCommon('tbd')}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="mds-numeric text-sm font-bold text-[var(--mds-text-muted)]">
                        {match.homeScore}:{match.awayScore}
                      </span>
                      <ArrowRight size={14} className="text-[var(--mds-action)] opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6 lg:col-span-4">
        <div className="mds-card space-y-4 p-5">
          <h3 className="text-sm font-bold tracking-tight">{t('share')}</h3>
          <LinkField
            label={t('publicPage')}
            copyLabel={t('copyPublicPage')}
            url={`${origin}/tournaments/${tournament.id}`}
            onCopy={onCopyPublicLink}
          />
          <LinkField label={t('overlay')} copyLabel={t('copyOverlay')} url={`${origin}/bracket/${tournament.id}/overlay`} />
        </div>

        <div className="mds-card p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold tracking-tight">{t('topSeeds')}</h3>
            {teams.length > 5 ? (
              <button
                onClick={() => onSetTab('participants')}
                className="text-xs font-semibold text-[var(--mds-action)] hover:underline"
              >
                {t('allTeams', { count: teams.length })}
              </button>
            ) : null}
          </div>
          <div className="space-y-2.5">
            {teams.slice(0, 5).map((team: any, index: number) => (
              <div key={team.id} className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mds-numeric text-xs text-[var(--mds-text-subtle)]">
                    {(index + 1).toString().padStart(2, '0')}
                  </span>
                  <span className="mds-name text-sm">{team.name}</span>
                </div>
                <Badge tone="neutral">{t('seed', { seed: team.seed || index + 1 })}</Badge>
              </div>
            ))}
            {teams.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--mds-text-subtle)]">{t('noTeams')}</p>
            ) : null}
          </div>
        </div>

        <div className="mds-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold tracking-tight">{t('activity')}</h3>
            <Bell size={15} className="text-[var(--mds-action)] opacity-60" />
          </div>
          {/* Scrolls in place: the activity feed is unbounded and would otherwise run hundreds of
              pixels past everything beside it. */}
          <div className="custom-scrollbar max-h-[320px] space-y-2.5 overflow-y-auto pr-1">
            {timeline.map((entry: any, index: number) => (
              <div key={`${entry.id}-${index}`} className="rounded-lg border border-[var(--mds-border)] bg-[var(--mds-input)]/30 px-3 py-2.5">
                <p className="text-[13px] font-semibold leading-snug">{entry.summary || entry.embed?.title}</p>
                <p className="mt-1 text-xs text-[var(--mds-text-muted)]">
                  {entry.actor ? `${entry.actor} · ` : ''}{new Date(entry.createdAt || entry.timestamp).toLocaleTimeString()}
                </p>
              </div>
            ))}
            {timeline.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[var(--mds-border)] px-3 py-5 text-center text-sm text-[var(--mds-text-subtle)]">
                {t('noActivity')}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
