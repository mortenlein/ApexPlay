'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Trophy, Zap, ArrowRight, Gamepad2, Radio, Activity, Shield, Hash } from 'lucide-react';
import { buildSteamConnectUrl } from '@/lib/match-links';
import { Button, Card, Badge, StatusBadge, EmptyState, TopNav } from '@/components/ui';
import { MyQueue } from '@/components/player/MyQueue';
import { EnableAlertsButton } from '@/components/player/EnableAlertsButton';

const PLAYER_NAV = [
  { href: '/dashboard', label: 'My desk' },
  { href: '/tournaments', label: 'Tournaments' },
  { href: '/profile', label: 'Profile' },
];

/**
 * Redesigned Player surface (exemplar for the new IA). Self-contained shell + content built
 * entirely on the design-system tokens and the ui/ kit. `profile` is the existing
 * /api/user/profile payload; `user` is the session user.
 */
export function PlayerHome({ user, profile }: { user: any; profile: any }) {
  const { registrations = [], stats, activeMatches = [] } = profile || {};
  const nextMatch = activeMatches[0];
  const connectUrl = nextMatch
    ? buildSteamConnectUrl(nextMatch.serverIp, nextMatch.serverPort, nextMatch.serverPassword)
    : null;

  const statRow = [
    { label: 'Tournaments', value: stats?.tournamentsJoined ?? 0, icon: Trophy },
    { label: 'Active matches', value: stats?.activeMatches ?? 0, icon: Activity },
    { label: 'Teams led', value: stats?.teamsLed ?? 0, icon: Shield },
    { label: 'Seats', value: stats?.seatAssignments ?? 0, icon: Hash },
  ];

  return (
    <div className="min-h-screen bg-page text-fg">
      <TopNav
        links={PLAYER_NAV}
        right={
          <>
            <EnableAlertsButton />
            <div className="flex items-center gap-2">
              {user?.image ? (
                <Image src={user.image} alt="" width={28} height={28} className="h-7 w-7 rounded-full border border-line" />
              ) : (
                <div className="h-7 w-7 rounded-full bg-card border border-line" />
              )}
              <span className="hidden text-sm font-semibold text-fg-muted sm:block">{user?.name}</span>
            </div>
          </>
        }
      />

      <main className="mds-container space-y-8 py-8">
        {/* Hero: next match */}
        <section>
          <p className="mds-uppercase-label text-fg-subtle">Player desk</p>
          <h1 className="mt-1 font-brand text-3xl font-bold tracking-tight">
            Welcome back{user?.name ? `, ${user.name}` : ''}
          </h1>

          <div className="mt-5">
            {nextMatch ? (
              <Card className="overflow-hidden p-0">
                <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Badge tone="info">Round {nextMatch.round}</Badge>
                      <StatusBadge status={nextMatch.status} />
                    </div>
                    <h2 className="font-brand text-2xl font-bold">
                      {nextMatch.homeTeam?.name || 'TBD'} <span className="text-fg-subtle">vs</span> {nextMatch.awayTeam?.name || 'TBD'}
                    </h2>
                    <p className="text-sm text-fg-muted">{nextMatch.tournament?.name}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {connectUrl ? (
                      <a href={connectUrl} data-testid={`join-match-${nextMatch.id}`}>
                        <Button>
                          <Zap size={15} />
                          One-click join
                        </Button>
                      </a>
                    ) : (
                      <Badge tone="pending">Server pending</Badge>
                    )}
                    <Link href={`/tournaments/${nextMatch.tournamentId}`}>
                      <Button variant="secondary">View bracket</Button>
                    </Link>
                  </div>
                </div>
              </Card>
            ) : (
              <EmptyState
                icon={<Radio size={26} />}
                title="No match assigned yet"
                description="When your team is scheduled, your match, seat, and one-click join link show up right here."
                action={<Link href="/tournaments"><Button>Browse tournaments</Button></Link>}
              />
            )}
          </div>
        </section>

        {/* Queue */}
        <MyQueue />

        {/* Stats */}
        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {statRow.map((s) => (
            <Card key={s.label} className="flex items-center justify-between">
              <div>
                <p className="mds-uppercase-label text-fg-subtle">{s.label}</p>
                <p className="mt-1 font-brand text-2xl font-bold">{s.value}</p>
              </div>
              <s.icon size={18} className="text-brand/50" />
            </Card>
          ))}
        </section>

        {/* Joined tournaments */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-brand text-lg font-bold">Your tournaments</h2>
            <Link href="/tournaments" className="text-sm font-semibold text-brand hover:underline">Browse all</Link>
          </div>
          {registrations.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {registrations.map((reg: any) => (
                <Link key={reg.id} href={`/tournaments/${reg.team.tournament.id}`}>
                  <Card interactive className="flex h-full flex-col justify-between gap-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <Badge tone="neutral">{reg.team.tournament.game}</Badge>
                        <h3 className="mt-2 font-brand text-lg font-bold">{reg.team.tournament.name}</h3>
                      </div>
                      <Trophy size={18} className="text-fg-subtle" />
                    </div>
                    <div className="flex items-center justify-between border-t border-line pt-3">
                      <div>
                        <p className="mds-uppercase-label text-fg-subtle">Team</p>
                        <p className="text-sm font-semibold text-brand">{reg.team.name}</p>
                      </div>
                      <ArrowRight size={16} className="text-fg-subtle" />
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Gamepad2 size={26} />}
              title="No tournaments joined yet"
              description="Join one to see your team, schedule, and join links here."
              action={<Link href="/tournaments"><Button>Browse tournaments</Button></Link>}
            />
          )}
        </section>
      </main>
    </div>
  );
}
