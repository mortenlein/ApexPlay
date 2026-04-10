'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Trophy, LayoutDashboard, ExternalLink, LogOut, Radio, Users, Swords, Activity, AlertTriangle, Shield, Copy, Megaphone, CalendarClock, Eye, EyeOff, Gauge } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import TournamentWizard from '@/components/TournamentWizard';
import { EmptyState, PanelHeader, WorkspaceChrome } from '@/components/workspace/WorkspaceChrome';
import { ApiError, apiRequest, clientApi } from '@/lib/client-api';
import { useToast } from '@/components/ToastProvider';
import FirstRunCoach from '@/components/FirstRunCoach';
import { usePerformanceBudget } from '@/hooks/usePerformanceBudget';

export default function AdminDashboardClient() {
  usePerformanceBudget('AdminDashboardClient', 220);
  const queryClient = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const [isCreating, setIsCreating] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['tournaments'],
    queryFn: async () => clientApi.getTournaments('all'),
  });

  const { data: activityData } = useQuery({
    queryKey: ['activity'],
    queryFn: async () => clientApi.getAuditLog(),
  });

  const { data: notificationData } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => clientApi.getNotifications(),
  });

  const tournaments = useMemo(() => data?.tournaments || [], [data?.tournaments]);
  const activity = useMemo(() => activityData?.entries || [], [activityData?.entries]);
  const notifications = useMemo(() => notificationData?.notifications || [], [notificationData?.notifications]);
  const totalTeams = tournaments.reduce((sum: number, tournament: any) => sum + (tournament._count?.teams || 0), 0);
  const totalMatches = tournaments.reduce((sum: number, tournament: any) => sum + (tournament._count?.matches || 0), 0);
  const needsSetup = tournaments.filter((tournament: any) => (tournament._count?.teams || 0) === 0).length;
  const readyForBracket = tournaments.filter((tournament: any) => (tournament._count?.teams || 0) > 1 && (tournament._count?.matches || 0) === 0).length;

  const handleLogout = async () => {
    try {
      await clientApi.logoutAdmin();
      toast.success('Signed out', 'Your admin session has been closed.');
      router.push('/login');
      router.refresh();
    } catch (logoutError) {
      toast.error('Could not sign out', logoutError instanceof Error ? logoutError.message : 'Try again in a moment.');
    }
  };

  const onWizardComplete = async (wizardData: any) => {
    try {
      const payload = { ...wizardData, type: wizardData.format };
      const result = await clientApi.createTournament(payload);
      await queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      await queryClient.invalidateQueries({ queryKey: ['activity'] });
      setIsCreating(false);
      toast.success('Tournament created', `${result.name} is ready for setup.`);
      return result.id;
    } catch (creationError) {
      const message = creationError instanceof ApiError ? creationError.message : 'Could not create tournament.';
      toast.error('Creation failed', message);
      throw creationError;
    }
  };

  const timeline = [...activity, ...notifications]
    .sort((a: any, b: any) => new Date(b.createdAt || b.timestamp).getTime() - new Date(a.createdAt || a.timestamp).getTime())
    .slice(0, 8);

  const health = useMemo(() => {
    const now = Date.now();
    const staleThresholdMs = 1000 * 60 * 15;
    const staleTournaments = tournaments.filter((t: any) => now - new Date(t.updatedAt).getTime() > staleThresholdMs).length;
    const failedNotifications = notifications.filter((n: any) => String(n.type || '').toUpperCase().includes('FAIL')).length;
    return {
      staleTournaments,
      failedNotifications,
      totalNotifications: notifications.length,
      queueHealthy: failedNotifications === 0,
    };
  }, [notifications, tournaments]);

  const duplicateTournament = async (tournamentId: string) => {
    const source = await clientApi.getTournament(tournamentId);
    const payload = {
      name: `${source.name} Copy`,
      game: source.game,
      format: source.format,
      teamSize: source.teamSize,
      bo3StartRound: source.bo3StartRound || null,
      bo5StartRound: source.bo5StartRound || null,
      hasThirdPlace: source.hasThirdPlace || false,
      type: source.type || source.format,
    };
    const created = await clientApi.createTournament(payload);
    await queryClient.invalidateQueries({ queryKey: ['tournaments'] });
    toast.success('Tournament duplicated', `${created.name} is ready for setup.`, {
      label: 'Open',
      onAction: () => router.push(`/admin/tournaments/${created.id}`),
    });
  };

  const togglePublished = async (tournament: any) => {
    const nextPublished = !tournament.steamSignupEnabled;
    await apiRequest(`/api/tournaments/${tournament.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        steamSignupEnabled: nextPublished,
        expectedUpdatedAt: tournament.updatedAt,
      }),
    });
    await queryClient.invalidateQueries({ queryKey: ['tournaments'] });
    toast.success(nextPublished ? 'Tournament published' : 'Tournament unpublished', `${tournament.name} ${nextPublished ? 'is now open for player sign-up' : 'is now hidden from sign-up'}.`, {
      label: nextPublished ? 'Unpublish' : 'Publish',
      onAction: () => {
        void togglePublished({ ...tournament, steamSignupEnabled: nextPublished });
      },
    });
  };

  const bulkSchedule = async (tournamentId: string, teamsCount: number) => {
    if (teamsCount < 2) {
      toast.info('Not enough teams', 'At least two teams are required to generate rounds.');
      return;
    }

    await apiRequest(`/api/tournaments/${tournamentId}/generate`, { method: 'POST' });
    toast.success('Rounds scheduled', 'Bracket rounds were generated for this tournament.');
  };

  const bulkAnnounce = async (tournamentId: string) => {
    const matches = await clientApi.getMatches(tournamentId);
    const targets = matches.filter((match: any) => ['READY', 'WAITING_FOR_PLAYERS', 'LIVE', 'COMPLETED'].includes(match.status)).slice(0, 8);
    if (targets.length === 0) {
      toast.info('No matches to announce', 'Create or load matches before broadcasting updates.');
      return;
    }

    await Promise.all(targets.map((match: any) => apiRequest('/api/discord/announce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matchId: match.id,
        tournamentId,
        type: match.status === 'COMPLETED' ? 'RESULT' : 'START',
      }),
    })));
    toast.success('Bulk announcements sent', `${targets.length} match update(s) were sent to Discord.`);
  };

  return (
    <WorkspaceChrome
      mode="admin"
      navLabel="Admin Dashboard"
      title="Tournament control center"
      subtitle="Create events, monitor readiness, and jump straight into bracket, marshal, or overlay views from one place."
      navItems={[
        { href: '/admin', label: 'Overview', icon: LayoutDashboard, matchMode: 'exact' },
        { href: '/marshal/dashboard', label: 'Marshal Board', icon: Radio, matchMode: 'prefix' },
        { href: '/tournaments', label: 'Public Site', icon: Trophy, matchMode: 'prefix' },
      ]}
      actions={
        <>
          <button onClick={() => setIsCreating(true)} className="mds-btn-primary h-10 px-5 text-xs font-black uppercase tracking-widest">
            <Plus size={16} />
            Create Tournament
          </button>
        </>
      }
      footer={
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[var(--mds-text-muted)] hover:bg-[var(--mds-red)]/10 hover:text-[var(--mds-red)] transition-all"
        >
          <LogOut size={18} />
          <span>Logout Session</span>
        </button>
      }
    >
      <div className="space-y-8">
        <FirstRunCoach
          id="admin"
          title="Run your first tournament"
          steps={[
            'Create or duplicate a tournament from this dashboard.',
            'Seed teams, generate rounds, then open the marshal board.',
            'Use bulk announce once matches are ready for players.',
          ]}
          cta={<button onClick={() => setIsCreating(true)} className="mds-btn-primary h-9 px-4 text-[10px] font-black uppercase tracking-widest">Create Tournament</button>}
        />

        <section className="grid grid-cols-1 gap-6 md:grid-cols-4">
          {[
            { label: 'Active Tournaments', value: tournaments.length, icon: Trophy, note: 'Tracked in this workspace' },
            { label: 'Registered Teams', value: totalTeams, icon: Users, note: 'Across all events' },
            { label: 'Scheduled Matches', value: totalMatches, icon: Swords, note: 'Created so far' },
            { label: 'Need Attention', value: needsSetup + readyForBracket, icon: AlertTriangle, note: 'Setup or bracket tasks' },
          ].map((stat) => (
            <div key={stat.label} className="mds-card relative overflow-hidden group hover:border-[var(--mds-action)] transition-all duration-300">
              <div className="absolute top-0 left-0 h-full w-1 bg-[var(--mds-action)] opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="mds-uppercase-label text-[11px]">{stat.label}</span>
              <div className="mt-1 flex items-end justify-between gap-4">
                <span className="text-3xl font-black tracking-tight leading-none text-[var(--mds-text-primary)]">{stat.value}</span>
                <div className="flex items-center gap-2 text-xs font-medium text-[var(--mds-text-subtle)]">
                  <stat.icon size={16} />
                  <span>{stat.note}</span>
                </div>
              </div>
            </div>
          ))}
        </section>

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1.6fr_1fr]">
          <section className="space-y-6">
            <PanelHeader
              eyebrow="Operations"
              title="Tournament workspace"
              description="Manage teams, brackets, overlays, and marshal context without leaving the admin side."
              actions={
                <Link href="/marshal/dashboard" className="mds-btn-secondary h-10 px-4 text-xs font-bold gap-2">
                  <Radio size={14} />
                  Open Marshal Board
                </Link>
              }
            />

            {error ? (
              <EmptyState
                icon={<Shield size={24} />}
                title="Could not load tournaments"
                description={error instanceof Error ? error.message : 'Try refreshing the page.'}
                action={<button onClick={() => queryClient.invalidateQueries({ queryKey: ['tournaments'] })} className="mds-btn-primary h-10 px-5 text-xs font-black uppercase tracking-widest">Retry</button>}
              />
            ) : isLoading ? (
              <div className="py-24 text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--mds-action)] border-t-transparent" />
                <p className="mt-4 mds-uppercase-label">Loading tournaments...</p>
              </div>
            ) : tournaments.length === 0 ? (
              <EmptyState
                icon={<Trophy size={28} />}
                title="No tournaments yet"
                description="Create your first tournament to start adding teams, generating brackets, and running matches."
                action={
                  <button onClick={() => setIsCreating(true)} className="mds-btn-primary h-11 px-8 text-xs font-black uppercase tracking-widest">
                    <Plus size={16} /> Create Tournament
                  </button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {tournaments.map((tournament: any) => (
                  <div key={tournament.id} className="mds-card flex flex-col gap-6 group hover:shadow-lg transition-all duration-300">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className={`mds-badge ${tournament.rosterLocked ? 'bg-[var(--mds-amber)]/10 text-[var(--mds-amber)] border border-[var(--mds-amber)]/20' : 'bg-[var(--mds-action-soft)] text-[var(--mds-action)] border border-[var(--mds-action)]/20'} text-[9px] font-black tracking-widest uppercase`}>
                          {tournament.rosterLocked ? 'Locked' : 'Editable'}
                        </span>
                        <h3 className="mt-4 text-xl font-black leading-tight group-hover:text-[var(--mds-action)] transition-colors">
                          {tournament.name}
                        </h3>
                        <p className="mt-2 text-sm text-[var(--mds-text-muted)]">
                          {tournament._count?.teams || 0} teams, {tournament._count?.matches || 0} matches, {tournament.game} · {tournament.category?.replaceAll('_', ' ').toLowerCase()}
                        </p>
                      </div>
                      <span className="mds-badge bg-[var(--mds-input)] text-[9px] uppercase tracking-widest">{tournament.game}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-[var(--mds-border)] bg-[var(--mds-input)]/20 px-4 py-3">
                        <p className="mds-uppercase-label text-[8px] opacity-40">Setup status</p>
                        <p className="mt-2 text-sm font-black">
                          {(tournament._count?.teams || 0) === 0 ? 'Need teams' : (tournament._count?.matches || 0) === 0 ? 'Ready to bracket' : 'Active bracket'}
                        </p>
                      </div>
                      <div className="rounded-lg border border-[var(--mds-border)] bg-[var(--mds-input)]/20 px-4 py-3">
                        <p className="mds-uppercase-label text-[8px] opacity-40">Signup</p>
                        <p className="mt-2 text-sm font-black">{tournament.steamSignupEnabled ? 'Steam sign-in' : 'Open entry'}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Link href={`/admin/tournaments/${tournament.id}`} className="mds-btn-primary h-10 justify-center text-[10px] font-black uppercase tracking-widest">
                        Open Admin
                      </Link>
                      <Link href={`/tournaments/${tournament.id}`} className="mds-btn-secondary h-10 justify-center text-[10px] font-black uppercase tracking-widest">
                        Public Page
                      </Link>
                      <button
                        type="button"
                        onClick={() => window.open(`/bracket/${tournament.id}/overlay`, '_blank', 'noopener,noreferrer')}
                        className="mds-btn-secondary h-10 justify-center gap-2 text-[10px] font-black uppercase tracking-widest"
                      >
                        <ExternalLink size={14} />
                        Overlay
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const confirmed = window.confirm(`Duplicate ${tournament.name}?\n\nImpact:\n- Creates a new tournament with copied settings.\n- Teams, matches, and logs are not copied.`);
                          if (!confirmed) return;
                          void duplicateTournament(tournament.id).catch((error) => {
                            toast.error('Duplicate failed', error instanceof Error ? error.message : 'Unable to duplicate tournament');
                          });
                        }}
                        className="mds-btn-secondary h-10 justify-center gap-2 text-[10px] font-black uppercase tracking-widest"
                      >
                        <Copy size={14} />
                        Duplicate
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const confirmed = window.confirm(`${tournament.steamSignupEnabled ? 'Unpublish' : 'Publish'} ${tournament.name}?\n\nImpact:\n- ${tournament.steamSignupEnabled ? 'Players can no longer join via sign-up.' : 'Players can join via sign-up.'}`);
                          if (!confirmed) return;
                          void togglePublished(tournament).catch((error) => {
                            toast.error('Publish toggle failed', error instanceof Error ? error.message : 'Unable to update visibility');
                          });
                        }}
                        className="mds-btn-secondary h-10 justify-center gap-2 text-[10px] font-black uppercase tracking-widest"
                      >
                        {tournament.steamSignupEnabled ? <EyeOff size={14} /> : <Eye size={14} />}
                        {tournament.steamSignupEnabled ? 'Unpublish' : 'Publish'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const confirmed = window.confirm(`Schedule rounds for ${tournament.name} now?\n\nImpact:\n- Existing bracket structure may be regenerated.`);
                          if (!confirmed) return;
                          void bulkSchedule(tournament.id, tournament._count?.teams || 0).catch((error) => {
                            toast.error('Scheduling failed', error instanceof Error ? error.message : 'Unable to schedule rounds');
                          });
                        }}
                        className="mds-btn-secondary h-10 justify-center gap-2 text-[10px] font-black uppercase tracking-widest"
                      >
                        <CalendarClock size={14} />
                        Schedule
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const confirmed = window.confirm(`Send bulk Discord announcements for ${tournament.name}?\n\nImpact:\n- START/RESULT updates will be pushed for active matches.`);
                          if (!confirmed) return;
                          void bulkAnnounce(tournament.id).catch((error) => {
                            toast.error('Announcement failed', error instanceof Error ? error.message : 'Unable to send announcements');
                          });
                        }}
                        className="mds-btn-secondary h-10 justify-center gap-2 text-[10px] font-black uppercase tracking-widest"
                      >
                        <Megaphone size={14} />
                        Announce
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <aside className="space-y-6">
            <div className="mds-card p-5 bg-[var(--mds-input)]/20">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-tight">Live Ops Health</h3>
                <Gauge size={16} className="text-[var(--mds-action)]" />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border border-[var(--mds-border)] px-3 py-2">
                  <span className="text-xs text-[var(--mds-text-muted)]">Notification queue</span>
                  <span className={`text-xs font-black uppercase ${health.queueHealthy ? 'text-[var(--mds-green)]' : 'text-[var(--mds-red)]'}`}>
                    {health.queueHealthy ? 'Healthy' : 'Errors'}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-[var(--mds-border)] px-3 py-2">
                  <span className="text-xs text-[var(--mds-text-muted)]">Stale tournaments</span>
                  <span className="text-xs font-black">{health.staleTournaments}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-[var(--mds-border)] px-3 py-2">
                  <span className="text-xs text-[var(--mds-text-muted)]">Failed notifications</span>
                  <span className="text-xs font-black text-[var(--mds-red)]">{health.failedNotifications}</span>
                </div>
              </div>
            </div>

            <PanelHeader
              eyebrow="Live Ops"
              title="Recent activity"
              description="Announcements, match actions, and tournament changes in one timeline."
            />
            <div className="space-y-3">
              {timeline.length > 0 ? timeline.map((entry: any, index: number) => (
                <div key={`${entry.id}-${index}`} className="mds-card p-4 bg-[var(--mds-input)]/20">
                  <p className="text-sm font-black tracking-tight text-[var(--mds-text-primary)]">
                    {entry.summary || entry.embed?.title}
                  </p>
                  <p className="mt-1 text-xs text-[var(--mds-text-muted)]">
                    {entry.actor ? `${entry.actor} · ` : ''}{new Date(entry.createdAt || entry.timestamp).toLocaleString()}
                  </p>
                </div>
              )) : (
                <EmptyState
                  icon={<Activity size={24} />}
                  title="No activity yet"
                  description="Actions like bracket generation, announcements, and roster updates will appear here."
                />
              )}
            </div>
          </aside>
        </div>
      </div>

      {isCreating ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 lg:p-12">
          <div className="absolute inset-0 bg-[var(--mds-overlay)] backdrop-blur-sm" onClick={() => setIsCreating(false)} />
          <div className="relative z-10 w-full max-w-4xl max-h-[90vh] overflow-hidden bg-[var(--mds-card)] rounded-xl border border-[var(--mds-border)] shadow-2xl shadow-black/40">
            <TournamentWizard
              onClose={() => setIsCreating(false)}
              onComplete={onWizardComplete}
            />
          </div>
        </div>
      ) : null}
    </WorkspaceChrome>
  );
}
