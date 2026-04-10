'use client';

import React from 'react';
import { Users, Sword, Shield, Zap, RefreshCw, BarChart3, Copy, Share2, ArrowRight, Clock3, Bell } from 'lucide-react';
import { InlineNotice } from '@/components/workspace/WorkspaceChrome';

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
  const liveMatches = matches.filter((match) => match.status === 'LIVE' || match.status === 'IN_PROGRESS').length;
  const waitingMatches = matches.filter((match) => match.status === 'WAITING_FOR_PLAYERS').length;
  const completedMatches = matches.filter((match) => match.status === 'COMPLETED').length;
  const bracketStatus =
    matches.length === 0
      ? 'Not generated'
      : liveMatches > 0
        ? 'Live matches running'
        : waitingMatches > 0
          ? 'Players joining'
          : 'Ready for the next round';

  const stats = [
    { label: 'Registered Teams', value: teams.length, icon: Users, color: 'var(--mds-action)' },
    { label: 'Total Matches', value: matches.length, icon: Sword, color: 'var(--mds-red)' },
    { label: 'Bracket State', value: bracketStatus, icon: Shield, color: tournament.rosterLocked ? 'var(--mds-amber)' : 'var(--mds-green)' },
  ];

  const timeline = [...activity, ...notifications]
    .sort((a: any, b: any) => new Date(b.createdAt || b.timestamp).getTime() - new Date(a.createdAt || a.timestamp).getTime())
    .slice(0, 5);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 animate-in fade-in duration-500">
      <div className="space-y-8 lg:col-span-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="mds-card p-6 flex items-center justify-between group hover:border-[var(--mds-action)]/20 transition-all">
              <div>
                <p className="mds-uppercase-label text-[8px] opacity-40 mb-1">{stat.label}</p>
                <p className="text-2xl font-black tracking-tight">{stat.value}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-[var(--mds-input)] border border-[var(--mds-border)] flex items-center justify-center opacity-40 group-hover:opacity-100 transition-opacity" style={{ color: stat.color }}>
                <stat.icon size={18} />
              </div>
            </div>
          ))}
        </div>

        {tournament.rosterLocked ? (
          <InlineNotice
            tone="warning"
            title="Bracket safety lock enabled"
            description="Team edits, seeding changes, and bracket regeneration are paused until roster edits are unlocked in settings."
          />
        ) : null}

        <div className="mds-card p-8">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BarChart3 size={20} className="text-[var(--mds-action)]" />
              <h2 className="text-lg font-black uppercase tracking-tight">Tournament Progress</h2>
            </div>
            <button
              onClick={() => {
                const summary = matches.length > 0
                  ? 'This will regenerate bracket rounds and may reshuffle pending matches.'
                  : 'This will create the initial bracket rounds for all currently seeded teams.';
                if (!window.confirm(`${matches.length > 0 ? 'Regenerate' : 'Generate'} bracket now?\n\nImpact:\n- ${summary}\n- Staff and player views will refresh.`)) {
                  return;
                }
                onGenerateMatches();
              }}
              disabled={generating || teams.length < 2 || (matches.length > 0 && tournament.rosterLocked)}
              className="mds-btn-primary h-10 px-6 text-xs gap-2 disabled:opacity-30"
            >
              {generating ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
              {matches.length > 0 ? 'Regenerate Bracket' : 'Generate Bracket'}
            </button>
          </div>

          {matches.length === 0 ? (
            <div className="py-20 text-center border-2 border-dashed border-[var(--mds-border)] rounded-xl bg-[var(--mds-input)]/10">
              <p className="mds-uppercase-label opacity-40 mb-2">Bracket not generated yet</p>
              <p className="text-sm font-medium text-[var(--mds-text-muted)]">Register at least 2 teams to generate the first round.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="mds-uppercase-label text-[9px] opacity-30 tracking-[0.2em] mb-4">Recent Match Updates</div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {matches.slice(0, 4).map((match: any) => (
                  <button
                    key={match.id}
                    onClick={() => onOpenMatchModal(match)}
                    className="flex items-center justify-between p-4 mds-card bg-[var(--mds-input)]/20 hover:border-[var(--mds-action)]/30 text-left transition-all group"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className={`shrink-0 h-2 w-2 rounded-full ${
                        match.status === 'LIVE' ? 'bg-[var(--mds-red)] animate-pulse shadow-[0_0_8px_var(--mds-red)]' :
                        match.status === 'COMPLETED' ? 'bg-[var(--mds-green)]' :
                        match.status === 'WAITING_FOR_PLAYERS' ? 'bg-[var(--mds-amber)]' :
                        'bg-[var(--mds-text-muted)]'
                      }`} />
                      <div className="truncate">
                        <p className="text-xs font-black uppercase truncate">{match.homeTeam?.name || 'TBD'} vs {match.awayTeam?.name || 'TBD'}</p>
                        <p className="mds-uppercase-label text-[8px] opacity-40">Match ID: {match.id.split('-')[0].toUpperCase()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <span className="font-mono text-sm font-bold opacity-60 group-hover:opacity-100 tabular-nums">{match.homeScore}:{match.awayScore}</span>
                      <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-[var(--mds-action)]" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-8 lg:col-span-4">
        <div className="mds-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight">Operations Pulse</h3>
              <p className="mt-1 text-xs text-[var(--mds-text-muted)]">What the floor and admin team need next.</p>
            </div>
            <Clock3 size={16} className="text-[var(--mds-action)]" />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-[var(--mds-border)] bg-[var(--mds-input)]/30 px-4 py-3">
              <span className="text-xs font-bold text-[var(--mds-text-muted)]">Live matches</span>
              <span className="text-sm font-black text-[var(--mds-red)]">{liveMatches}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-[var(--mds-border)] bg-[var(--mds-input)]/30 px-4 py-3">
              <span className="text-xs font-bold text-[var(--mds-text-muted)]">Waiting for players</span>
              <span className="text-sm font-black text-[var(--mds-amber)]">{waitingMatches}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-[var(--mds-border)] bg-[var(--mds-input)]/30 px-4 py-3">
              <span className="text-xs font-bold text-[var(--mds-text-muted)]">Results posted</span>
              <span className="text-sm font-black text-[var(--mds-green)]">{completedMatches}</span>
            </div>
          </div>
        </div>

        <div className="mds-card p-6 bg-[var(--mds-action-soft)] border-[var(--mds-action)]/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="mds-uppercase-label text-[var(--mds-action)]">Public tournament page</h3>
            <Share2 size={16} className="text-[var(--mds-action)] opacity-40" />
          </div>
          <div className="relative group">
            <div className="bg-[var(--mds-card)] border border-[var(--mds-border)] rounded-lg px-4 py-3 flex items-center justify-between overflow-hidden shadow-inner">
              <span className="font-mono text-[10px] text-[var(--mds-action)] font-bold truncate opacity-80 group-hover:opacity-100 transition-opacity">
                {typeof window !== 'undefined' ? `${window.location.host}/tournaments/${tournament.id}` : ''}
              </span>
              <button
                onClick={onCopyPublicLink}
                className="mds-btn-secondary h-8 w-8 p-0 shrink-0 text-[var(--mds-action)] hover:bg-[var(--mds-action)]/10"
              >
                <Copy size={14} />
              </button>
            </div>
          </div>
        </div>

        <div className="mds-card p-6">
          <h3 className="mds-uppercase-label mb-6">Top Seeds</h3>
          <div className="space-y-4">
            {teams.slice(0, 5).map((team: any, index: number) => (
              <div key={team.id} className="flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono opacity-20">{(index + 1).toString().padStart(2, '0')}</span>
                  <span className="text-sm font-black uppercase truncate max-w-[150px] group-hover:text-[var(--mds-action)] transition-colors">{team.name}</span>
                </div>
                <span className="mds-badge bg-[var(--mds-input)] text-[9px] opacity-60">Seed {team.seed || index + 1}</span>
              </div>
            ))}
            {teams.length > 5 ? (
              <button onClick={() => onSetTab('participants')} className="w-full pt-4 mt-4 border-t border-[var(--mds-border)] text-center text-[10px] font-black mds-uppercase-label text-[var(--mds-action)] hover:tracking-widest transition-all">
                View all teams ({teams.length})
              </button>
            ) : null}
            {teams.length === 0 ? (
              <div className="py-10 text-center opacity-30">
                <p className="mds-uppercase-label text-[9px]">No teams registered</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mds-card p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight">Activity Timeline</h3>
              <p className="mt-1 text-xs text-[var(--mds-text-muted)]">Recent admin actions and alerts.</p>
            </div>
            <Bell size={16} className="text-[var(--mds-action)]" />
          </div>
          <div className="space-y-3">
            {timeline.map((entry: any, index: number) => (
              <div key={`${entry.id}-${index}`} className="rounded-lg border border-[var(--mds-border)] bg-[var(--mds-input)]/30 px-4 py-3">
                <p className="text-[11px] font-black tracking-tight text-[var(--mds-text-primary)]">
                  {entry.summary || entry.embed?.title}
                </p>
                <p className="mt-1 text-[11px] text-[var(--mds-text-muted)]">
                  {entry.actor ? `${entry.actor} · ` : ''}{new Date(entry.createdAt || entry.timestamp).toLocaleTimeString()}
                </p>
              </div>
            ))}
            {timeline.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--mds-border)] px-4 py-6 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--mds-text-subtle)]">No activity yet</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
