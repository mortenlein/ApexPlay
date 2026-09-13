'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Trophy, ExternalLink, Radio, Users, Swords, Activity, AlertTriangle, Shield, Copy, Megaphone, CalendarClock, Eye, EyeOff, Gauge } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import TournamentWizard from '@/components/TournamentWizard';
import { EmptyState } from '@/components/workspace/WorkspaceChrome';
import { Badge } from '@/components/ui';
import { isActive, isDone } from '@/lib/match-status';
import { getGameMetadata } from '@/lib/games';
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

  const onWizardComplete = async (wizardData: any) => {
    try {
      const payload = { ...wizardData, type: wizardData.format };
      const result = await clientApi.createTournament(payload);
      await queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      await queryClient.invalidateQueries({ queryKey: ['activity'] });
      // The wizard stays open on its final step (share link / go to setup); its Close calls onClose.
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
    .slice(0, 6);

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
      bo3LastRounds: source.bo3LastRounds || null,
      bo5LastRounds: source.bo5LastRounds || null,
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

  const bulkSchedule = async (tournamentId: string, teamsCount: number, matchesCount: number) => {
    if (teamsCount < 2) {
      toast.info('Not enough teams', 'At least two teams are required to generate rounds.');
      return;
    }

    // Generating locks the roster, so rebuilding an existing bracket has to pass overrideLock
    // or the lock guard refuses it.
    const regenerating = matchesCount > 0;
    await apiRequest(`/api/tournaments/${tournamentId}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(regenerating ? { overrideLock: true } : {}),
    });
    toast.success(
      regenerating ? 'Bracket regenerated' : 'Bracket generated',
      regenerating
        ? 'Existing matches were replaced with a fresh bracket.'
        : 'Bracket rounds were generated for this tournament.'
    );
  };

  const bulkAnnounce = async (tournamentId: string) => {
    const matches = await clientApi.getMatches(tournamentId);
    const targets = matches.filter((match: any) => isActive(match.status) || isDone(match.status)).slice(0, 8);
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

  /** What this tournament still needs from the organizer — the only per-row state the list payload can back. */
  const setupState = (tournament: any) => {
    const teamCount = tournament._count?.teams || 0;
    const matchCount = tournament._count?.matches || 0;
    if (teamCount === 0) return { label: 'Needs teams', tone: 'pending' as const };
    if (matchCount === 0) return { label: 'Ready to bracket', tone: 'info' as const };
    return { label: 'Bracket live', tone: 'ready' as const };
  };

  /** The secondary actions on a tournament row: real work, but never competing with Open. */
  const rowActions = (tournament: any) => [
    {
      label: 'Overlay',
      icon: ExternalLink,
      run: () => window.open(`/bracket/${tournament.id}/overlay`, '_blank', 'noopener,noreferrer'),
    },
    {
      label: 'Duplicate',
      icon: Copy,
      run: () => {
        const confirmed = window.confirm(`Duplicate ${tournament.name}?\n\nImpact:\n- Creates a new tournament with copied settings.\n- Teams, matches, and logs are not copied.`);
        if (!confirmed) return;
        void duplicateTournament(tournament.id).catch((duplicateError) => {
          toast.error('Duplicate failed', duplicateError instanceof Error ? duplicateError.message : 'Unable to duplicate tournament');
        });
      },
    },
    {
      label: tournament.steamSignupEnabled ? 'Unpublish' : 'Publish',
      icon: tournament.steamSignupEnabled ? EyeOff : Eye,
      run: () => {
        const confirmed = window.confirm(`${tournament.steamSignupEnabled ? 'Unpublish' : 'Publish'} ${tournament.name}?\n\nImpact:\n- ${tournament.steamSignupEnabled ? 'Players can no longer join via sign-up.' : 'Players can join via sign-up.'}`);
        if (!confirmed) return;
        void togglePublished(tournament).catch((publishError) => {
          toast.error('Publish toggle failed', publishError instanceof Error ? publishError.message : 'Unable to update visibility');
        });
      },
    },
    {
      label: 'Schedule',
      icon: CalendarClock,
      run: () => {
        const hasMatches = (tournament._count?.matches || 0) > 0;
        const confirmed = window.confirm(hasMatches
          ? 'This will delete all existing matches and results and rebuild the bracket. Continue?'
          : `Schedule rounds for ${tournament.name} now?\n\nImpact:\n- The first round is created from the seeded teams and roster edits are locked.`);
        if (!confirmed) return;
        void bulkSchedule(tournament.id, tournament._count?.teams || 0, tournament._count?.matches || 0).catch((scheduleError) => {
          toast.error('Scheduling failed', scheduleError instanceof Error ? scheduleError.message : 'Unable to schedule rounds');
        });
      },
    },
    {
      label: 'Announce',
      icon: Megaphone,
      run: () => {
        const confirmed = window.confirm(`Send bulk Discord announcements for ${tournament.name}?\n\nImpact:\n- START/RESULT updates will be pushed for active matches.`);
        if (!confirmed) return;
        void bulkAnnounce(tournament.id).catch((announceError) => {
          toast.error('Announcement failed', announceError instanceof Error ? announceError.message : 'Unable to send announcements');
        });
      },
    },
  ];

  return (
    <div className="min-h-screen bg-page text-fg">
      <main className="mds-container space-y-6 py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mds-uppercase-label text-brand">Admin</p>
            <h1 className="mt-1 font-brand text-2xl font-bold tracking-tight">Tournament control center</h1>
            <p className="mt-1.5 max-w-2xl text-sm text-fg-muted">
              Create events, see what still needs setting up, and open the workspace you run the LAN from.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link href="/marshal/dashboard" className="mds-btn-secondary h-10 gap-2 px-4 text-sm font-bold">
              <Radio size={14} />
              Marshal board
            </Link>
            <button onClick={() => setIsCreating(true)} className="mds-btn-primary h-10 gap-2 px-4 text-sm font-bold">
              <Plus size={15} />
              Create
            </button>
          </div>
        </div>

        <FirstRunCoach
          id="admin"
          title="Run your first tournament"
          steps={[
            'Create or duplicate a tournament from this dashboard.',
            'Seed teams, generate rounds, then open the marshal board.',
            'Use bulk announce once matches are ready for players.',
          ]}
          cta={
            <button onClick={() => setIsCreating(true)} className="mds-btn-primary h-9 px-4 text-sm font-bold">
              Create Tournament
            </button>
          }
        />

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: 'Tournaments', value: tournaments.length, icon: Trophy, note: 'In this workspace' },
            { label: 'Teams', value: totalTeams, icon: Users, note: 'Across all events' },
            { label: 'Matches', value: totalMatches, icon: Swords, note: 'Created so far' },
            { label: 'Need attention', value: needsSetup + readyForBracket, icon: AlertTriangle, note: 'Setup or bracket tasks' },
          ].map((stat) => (
            <div key={stat.label} className="mds-card p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="mds-uppercase-label">{stat.label}</span>
                <stat.icon size={14} className="shrink-0 text-fg-subtle" />
              </div>
              <p className="mds-numeric mt-1 text-2xl font-bold leading-none">{stat.value}</p>
              <p className="mt-1.5 text-xs text-fg-subtle">{stat.note}</p>
            </div>
          ))}
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.7fr_1fr]">
          <section className="space-y-3">
            <h2 className="mds-uppercase-label">Tournaments</h2>

            {error ? (
              <EmptyState
                icon={<Shield size={24} />}
                title="Could not load tournaments"
                description={error instanceof Error ? error.message : 'Try refreshing the page.'}
                action={
                  <button
                    onClick={() => queryClient.invalidateQueries({ queryKey: ['tournaments'] })}
                    className="mds-btn-primary h-10 px-5 text-sm font-bold"
                  >
                    Retry
                  </button>
                }
              />
            ) : isLoading ? (
              <div className="py-20 text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                <p className="mds-uppercase-label mt-4">Loading tournaments…</p>
              </div>
            ) : tournaments.length === 0 ? (
              <EmptyState
                icon={<Trophy size={28} />}
                title="No tournaments yet"
                description="Create your first tournament to start adding teams, generating brackets, and running matches."
                action={
                  <button onClick={() => setIsCreating(true)} className="mds-btn-primary h-11 gap-2 px-6 text-sm font-bold">
                    <Plus size={16} /> Create Tournament
                  </button>
                }
              />
            ) : (
              tournaments.map((tournament: any) => {
                const state = setupState(tournament);
                return (
                  <div key={tournament.id} className="mds-card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="mds-name text-base">{tournament.name}</h3>
                          <Badge tone={state.tone}>{state.label}</Badge>
                          {tournament.rosterLocked ? <Badge tone="pending">Locked</Badge> : null}
                        </div>
                        <p className="mt-1 text-sm text-fg-muted">
                          {tournament._count?.teams || 0} teams, {tournament._count?.matches || 0} matches, {getGameMetadata(tournament.game)?.name || tournament.game}
                          {' · '}
                          {tournament.steamSignupEnabled ? 'Steam sign-up open' : 'Sign-up closed'}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Link href={`/admin/tournaments/${tournament.id}`} className="mds-btn-primary h-9 px-4 text-sm font-bold">
                          Open
                        </Link>
                        <Link href={`/tournaments/${tournament.id}`} className="mds-btn-secondary h-9 px-4 text-sm font-bold">
                          Public page
                        </Link>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-3">
                      {rowActions(tournament).map((action) => (
                        <button
                          key={action.label}
                          type="button"
                          onClick={action.run}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-fg-muted transition-colors hover:text-brand"
                        >
                          <action.icon size={13} />
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </section>

          <aside className="space-y-4">
            <div className="mds-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold tracking-tight">Live ops health</h2>
                <Gauge size={15} className="text-brand" />
              </div>
              <div className="space-y-2">
                {[
                  {
                    label: 'Notification queue',
                    value: health.queueHealthy ? 'Healthy' : 'Errors',
                    className: health.queueHealthy ? 'text-success' : 'text-danger',
                  },
                  { label: 'Stale tournaments', value: String(health.staleTournaments), className: 'text-fg' },
                  {
                    label: 'Failed notifications',
                    value: String(health.failedNotifications),
                    className: health.failedNotifications > 0 ? 'text-danger' : 'text-fg',
                  },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between rounded-sm border border-line px-3 py-2">
                    <span className="text-xs text-fg-muted">{row.label}</span>
                    <span className={`mds-numeric text-xs font-bold ${row.className}`}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mds-card p-4">
              <h2 className="mb-3 text-sm font-bold tracking-tight">Recent activity</h2>
              <div className="space-y-2">
                {timeline.length > 0 ? timeline.map((entry: any, index: number) => (
                  <div key={`${entry.id}-${index}`} className="rounded-sm border border-line px-3 py-2">
                    <p className="text-[13px] font-semibold leading-snug">{entry.summary || entry.embed?.title}</p>
                    <p className="mt-1 text-xs text-fg-muted">
                      {entry.actor ? `${entry.actor} · ` : ''}{new Date(entry.createdAt || entry.timestamp).toLocaleString()}
                    </p>
                  </div>
                )) : (
                  <EmptyState
                    icon={<Activity size={24} />}
                    title="No activity yet"
                    description="Bracket generation, announcements, and roster updates appear here."
                  />
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* The wizard is its own full-screen overlay — wrapping it in a second one left an empty
          card floating behind the dialog. */}
      {isCreating ? (
        <TournamentWizard onClose={() => setIsCreating(false)} onComplete={onWizardComplete} />
      ) : null}
    </div>
  );
}
