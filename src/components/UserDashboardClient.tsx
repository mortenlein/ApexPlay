'use client';

import { useSession, signIn } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { Trophy, ShieldCheck, Loader2, Gamepad2, ArrowRight, Shield, Activity, Zap, Hash, LayoutDashboard, User, Play, Radio } from 'lucide-react';
import { buildSteamConnectUrl } from '@/lib/match-links';
import { MockPersonaButtons } from '@/components/MockPersonaButtons';
import { clientApi } from '@/lib/client-api';
import { EmptyState, PanelHeader, WorkspaceChrome } from '@/components/workspace/WorkspaceChrome';
import FirstRunCoach from '@/components/FirstRunCoach';
import { usePerformanceBudget } from '@/hooks/usePerformanceBudget';

export default function UserDashboardClient() {
  usePerformanceBudget('UserDashboardClient', 200);
  const { data: session, status } = useSession();

  const { data: profile, isLoading, error, refetch } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => clientApi.getProfile(),
    enabled: status === 'authenticated',
  });

  if (status === 'loading' || (status === 'authenticated' && isLoading)) {
    return (
      <div className="min-h-screen bg-[var(--mds-page)] flex flex-col items-center justify-center gap-6">
        <Loader2 className="animate-spin text-[var(--mds-action)]" size={40} />
        <span className="mds-uppercase-label opacity-40 uppercase tracking-[0.2em]">Loading your dashboard...</span>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-[var(--mds-page)] flex flex-col items-center justify-center p-8 text-center gap-10">
        <div className="h-20 w-20 rounded-xl flex items-center justify-center bg-[var(--mds-action)]/10 border border-[var(--mds-action)]/20">
          <ShieldCheck size={40} className="text-[var(--mds-action)]" />
        </div>
        <div className="max-w-md space-y-4">
          <h1 className="text-4xl font-black tracking-tight text-[var(--mds-text-primary)] uppercase leading-[0.9]">Sign in to see your matches</h1>
          <p className="text-[var(--mds-text-muted)] font-medium leading-relaxed">
            Connect with Steam to view your team, seat assignment, and one-click join links.
          </p>
        </div>
        <button
          onClick={() => signIn('steam')}
          className="mds-btn-primary h-14 px-10 text-xs font-bold uppercase tracking-widest gap-3"
        >
          <Zap size={16} fill="currentColor" />
          Continue with Steam
        </button>
        <MockPersonaButtons callbackUrl="/dashboard" />
      </div>
    );
  }

  const { registrations = [], stats, activeMatches = [] } = profile || {};
  const statCards = [
    { label: 'Joined Tournaments', value: stats?.tournamentsJoined || 0, icon: Activity },
    { label: 'Active Matches', value: stats?.activeMatches || 0, icon: Trophy },
    { label: 'Teams Led', value: stats?.teamsLed || 0, icon: Shield },
    { label: 'Seat Assignments', value: stats?.seatAssignments || 0, icon: Hash },
  ];

  return (
    <WorkspaceChrome
      mode="public"
      navLabel="Player Dashboard"
      title="Your match desk"
      subtitle="See what you have joined, where you are seated, and jump into live matches without hunting through the public site."
      navItems={[
        { href: '/dashboard', label: 'My Dashboard', icon: LayoutDashboard, matchMode: 'exact' },
        { href: '/tournaments', label: 'Tournaments', icon: Trophy, matchMode: 'prefix' },
        { href: '/profile', label: 'Profile', icon: User, matchMode: 'prefix' },
        { href: '/marshal/dashboard', label: 'Marshal Board', icon: Radio, matchMode: 'prefix' },
      ]}
      actions={
        <div className="hidden md:flex items-center gap-4">
          <div className="flex flex-col text-right">
            <span className="text-[10px] font-black text-[var(--mds-text-muted)] uppercase tracking-widest">{session?.user?.name}</span>
            <span className="text-[8px] font-bold text-[var(--mds-action)]">Signed in</span>
          </div>
          {session?.user?.image ? (
            <Image
              src={session.user.image}
              alt="Profile"
              width={36}
              height={36}
              className="h-9 w-9 rounded-lg border border-[var(--mds-border)]"
            />
          ) : null}
        </div>
      }
      footer={
        <div className="px-3 py-4 bg-[var(--mds-input)]/50 rounded-xl border border-[var(--mds-border)]">
          <div className="flex items-center gap-3">
            <div className={`h-8 w-8 rounded-full ${activeMatches.length > 0 ? 'bg-[var(--mds-green)]' : 'bg-[var(--mds-action)]'} animate-pulse shadow-[0_0_8px_currentColor]`} />
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase text-[var(--mds-text-primary)]">{activeMatches.length > 0 ? 'Match ready' : 'Waiting for bracket'}</span>
              <span className="text-[9px] font-bold text-[var(--mds-text-muted)]">{activeMatches.length > 0 ? 'Join link available' : 'We will show it here'}</span>
            </div>
          </div>
        </div>
      }
    >
      <div className="space-y-8">
        <FirstRunCoach
          id="player"
          title="Get match-ready in three steps"
          steps={[
            'Join a tournament from the directory.',
            'Check seat assignment and join status here.',
            'Use one-click join as soon as your match is marked ready.',
          ]}
          cta={<Link href="/tournaments" className="mds-btn-primary h-9 px-4 text-[10px] font-black uppercase tracking-widest">Browse Tournaments</Link>}
        />

        <section className="grid grid-cols-1 gap-6 md:grid-cols-4">
          {statCards.map((stat) => (
            <div key={stat.label} className="mds-card relative overflow-hidden group hover:border-[var(--mds-action)]/50 transition-all">
              <span className="mds-uppercase-label text-[10px] opacity-40">{stat.label}</span>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-2xl font-black tracking-tighter">{stat.value}</span>
                <div className="text-[var(--mds-action)] opacity-30 group-hover:opacity-100 transition-opacity">
                  <stat.icon size={18} />
                </div>
              </div>
            </div>
          ))}
        </section>

        <section className="space-y-6">
          <PanelHeader
            eyebrow="Live Match"
            title="Your next match"
            description="This is the fastest path to get on server. If the join link is not ready yet, your seat information still appears here."
          />

          {error ? (
            <EmptyState
              icon={<Shield size={24} />}
              title="Could not load your dashboard"
              description={error instanceof Error ? error.message : 'Try again in a moment.'}
              action={<button onClick={() => void refetch()} className="mds-btn-primary h-10 px-5 text-xs font-black uppercase tracking-widest">Retry</button>}
            />
          ) : activeMatches.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              {activeMatches.map((match: any) => {
                const connectUrl = buildSteamConnectUrl(match.serverIp, match.serverPort, match.serverPassword);
                const myTeam = match.playerTeamId === match.homeTeamId ? match.homeTeam : match.awayTeam;
                const seatSummary = (myTeam?.players || [])
                  .map((player: any) => player.seating)
                  .filter(Boolean)
                  .join(', ');

                return (
                  <div key={match.id} className="mds-card p-6 bg-[var(--mds-input)]/20">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="mds-uppercase-label text-[9px] opacity-40">Round {match.round}</p>
                        <h3 className="text-xl font-black mt-2">
                          {match.homeTeam?.name || 'TBD'} vs {match.awayTeam?.name || 'TBD'}
                        </h3>
                        <p className="mt-2 text-sm text-[var(--mds-text-muted)]">
                          {match.tournament.name}
                        </p>
                      </div>
                      <span className="mds-badge bg-[var(--mds-action-soft)] text-[var(--mds-action)]">
                        {match.status.replaceAll('_', ' ')}
                      </span>
                    </div>

                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="rounded-xl border border-[var(--mds-border)] bg-[var(--mds-page)] p-4">
                        <p className="mds-uppercase-label text-[8px] opacity-40">Seat numbers</p>
                        <p className="mt-2 text-sm font-bold">{seatSummary || 'Check with floor staff'}</p>
                      </div>
                      <div className="rounded-xl border border-[var(--mds-border)] bg-[var(--mds-page)] p-4">
                        <p className="mds-uppercase-label text-[8px] opacity-40">Join status</p>
                        <p className="mt-2 text-sm font-bold">
                          {connectUrl ? 'Server ready' : 'Waiting for server details'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-col sm:flex-row gap-3">
                      {connectUrl ? (
                        <a href={connectUrl} data-testid={`join-match-${match.id}`} className="mds-btn-primary h-11 px-5 text-xs font-bold uppercase tracking-widest gap-2">
                          <Zap size={14} />
                          One-click join
                        </a>
                      ) : (
                        <div className="mds-btn-secondary h-11 px-5 text-xs font-bold uppercase tracking-widest gap-2 pointer-events-none opacity-70">
                          <Gamepad2 size={14} />
                          Seat info shown above
                        </div>
                      )}
                      <Link href={`/tournaments/${match.tournamentId}`} className="mds-btn-secondary h-11 px-5 text-xs font-bold uppercase tracking-widest gap-2">
                        <Play size={14} />
                        View tournament
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={<Trophy size={28} />}
              title="No match assigned yet"
              description="Once your team is scheduled, the join link and seat numbers will appear here."
            />
          )}
        </section>

        <section className="space-y-6">
          <PanelHeader
            eyebrow="Joined Events"
            title="Your tournaments"
            description="Everything you have joined so far, with quick access back to the public tournament pages."
            actions={<Link href="/tournaments" className="text-xs font-bold text-[var(--mds-action)] uppercase tracking-widest hover:tracking-[0.2em] transition-all">Browse all</Link>}
          />

          {registrations?.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {registrations.map((reg: any) => (
                <Link
                  key={reg.id}
                  href={`/tournaments/${reg.team.tournament.id}`}
                  className="mds-card group p-6 flex flex-col gap-6 hover:border-[var(--mds-action)]/30 transition-all bg-[var(--mds-input)]/20"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="mds-badge bg-[var(--mds-action)]/10 text-[var(--mds-action)] uppercase text-[8px] font-black tracking-widest mb-1">{reg.team.tournament.game}</span>
                      <h3 className="text-xl font-black group-hover:text-[var(--mds-action)] transition-colors truncate max-w-[250px]">
                        {reg.team.tournament.name}
                      </h3>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-[var(--mds-page)] border border-[var(--mds-border)] flex items-center justify-center text-[var(--mds-text-muted)] group-hover:text-[var(--mds-action)] group-hover:border-[var(--mds-action)]/40 transition-all">
                      <Trophy size={18} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-[var(--mds-border)]/50">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black uppercase opacity-30">Team</span>
                      <span className="text-[11px] font-bold text-[var(--mds-action)]">{reg.team.name}</span>
                    </div>
                    <ArrowRight size={16} className="text-[var(--mds-text-muted)] group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Gamepad2 size={28} />}
              title="No tournaments joined yet"
              description="Join a tournament to see your team, match schedule, and join links here."
              action={<Link href="/tournaments" className="mds-btn-primary h-11 px-8 text-xs font-black uppercase tracking-widest">Browse tournaments</Link>}
            />
          )}
        </section>
      </div>
    </WorkspaceChrome>
  );
}
