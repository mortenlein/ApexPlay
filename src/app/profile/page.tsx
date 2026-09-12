'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Gamepad2, Loader2, LogOut, ShieldCheck, Zap } from 'lucide-react';
import { Badge, Button, Card, EmptyState } from '@/components/ui';
import { MockPersonaButtons } from '@/components/MockPersonaButtons';
import { SeatEditor } from '@/components/player/SeatEditor';

/**
 * /profile — the account, and the one thing a player actually changes on it: their seat in each
 * tournament they're registered for. Anything this page cannot back with data (a settings screen
 * that doesn't exist, a second "linked account" nobody links) is deliberately not here.
 */
export default function ProfilePage() {
    const { data: session, status } = useSession();
    const queryClient = useQueryClient();

    const { data: profile, isLoading } = useQuery({
        queryKey: ['profile'],
        queryFn: async () => {
            const res = await fetch('/api/user/profile?view=profile');
            if (!res.ok) throw new Error('Failed to fetch profile');
            return res.json();
        },
        enabled: status === 'authenticated',
        staleTime: 60_000,
    });

    if (status === 'unauthenticated') {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-page p-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-brand/20 bg-brand-soft">
                    <ShieldCheck size={34} className="text-brand" />
                </div>
                <div className="max-w-md space-y-3">
                    <h1 className="font-brand text-3xl font-bold tracking-tight">Sign in to see your profile</h1>
                    <p className="text-fg-muted">
                        Your teams, the tournaments you&apos;re in, and the seat each of them knows you by.
                    </p>
                </div>
                <Button onClick={() => signIn('steam')}>
                    <Zap size={15} />
                    Continue with Steam
                </Button>
                <MockPersonaButtons callbackUrl="/profile" />
            </div>
        );
    }

    const loading = status === 'loading' || (status === 'authenticated' && isLoading);
    const { registrations = [], stats } = profile || {};
    const facts = [
        { n: stats?.tournamentsJoined ?? 0, one: 'tournament', many: 'tournaments' },
        { n: stats?.activeMatches ?? 0, one: 'open match', many: 'open matches' },
        { n: stats?.seatAssignments ?? 0, one: 'seat saved', many: 'seats saved' },
    ];

    return (
        <div className="min-h-screen bg-page text-fg">
            <main className="mds-container space-y-6 py-6 sm:py-8">
                <header className="flex flex-wrap items-center gap-4">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-line bg-card">
                        {session?.user?.image ? (
                            <Image
                                src={session.user.image}
                                alt=""
                                width={56}
                                height={56}
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <span className="flex h-full w-full items-center justify-center text-fg-subtle">
                                <Gamepad2 size={22} />
                            </span>
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="mds-uppercase-label text-fg-subtle">Player profile</p>
                        {/* The player's own casing — never shouted back at them. */}
                        <h1 className="mds-name-lg text-2xl">{session?.user?.name}</h1>
                        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-fg-muted">
                            {facts.map((f) => (
                                <span key={f.one}>
                                    <span className="mds-numeric font-bold text-fg">{f.n}</span>{' '}
                                    {f.n === 1 ? f.one : f.many}
                                </span>
                            ))}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge tone="ready">Steam connected</Badge>
                        <Button
                            variant="secondary"
                            type="button"
                            onClick={async () => {
                                try {
                                    await fetch('/api/auth/logout', { method: 'POST' });
                                } catch {
                                    // Best effort admin-cookie cleanup before NextAuth sign-out.
                                }
                                await signOut({ callbackUrl: '/' });
                            }}
                        >
                            <LogOut size={15} />
                            Sign out
                        </Button>
                    </div>
                </header>

                <section className="space-y-3">
                    <p className="mds-uppercase-label text-fg-subtle">Your tournaments</p>

                    {loading && registrations.length === 0 && (
                        <Card className="flex items-center gap-3" aria-busy="true">
                            <Loader2 size={16} className="animate-spin text-brand" />
                            <span className="text-sm text-fg-muted">Loading your tournaments…</span>
                        </Card>
                    )}

                    {!loading && registrations.length === 0 && (
                        <EmptyState
                            icon={<Gamepad2 size={26} />}
                            title="No tournaments yet"
                            description="Sign up for one and it shows up here with your team and your seat."
                            action={
                                <Link href="/tournaments">
                                    <Button>Browse tournaments</Button>
                                </Link>
                            }
                        />
                    )}

                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                        {registrations.map((reg: any) => (
                            // Not one big link: the seat editor inside is interactive, and a button
                            // nested in an anchor is invalid markup and a click trap.
                            <Card key={reg.id} className="space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                    <Link
                                        href={`/tournaments/${reg.team.tournament.id}`}
                                        className="group flex min-w-0 items-start gap-2"
                                    >
                                        <h2 className="mds-name-lg text-lg group-hover:text-brand">
                                            {reg.team.tournament.name}
                                        </h2>
                                        <ArrowRight
                                            size={15}
                                            className="mt-1.5 shrink-0 text-fg-subtle group-hover:text-brand"
                                        />
                                    </Link>
                                    <Badge tone="neutral">{reg.team.tournament.game}</Badge>
                                </div>
                                <div className="grid grid-cols-2 gap-3 border-t border-line pt-3">
                                    <div className="min-w-0">
                                        <p className="mds-uppercase-label text-fg-subtle">Team</p>
                                        <p className="mds-name mt-1 text-sm">
                                            {reg.team.name}
                                            {reg.isLeader && (
                                                <span className="ml-1 text-xs text-fg-subtle">(leader)</span>
                                            )}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="mds-uppercase-label text-fg-subtle">Your seat</p>
                                        <SeatEditor
                                            className="mt-1"
                                            tournamentId={reg.team.tournament.id}
                                            seating={reg.seating}
                                            onSaved={() => queryClient.invalidateQueries({ queryKey: ['profile'] })}
                                        />
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
}
