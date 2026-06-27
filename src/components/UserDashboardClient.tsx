'use client';

import { useSession, signIn } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, Loader2, Zap, AlertTriangle } from 'lucide-react';
import { MockPersonaButtons } from '@/components/MockPersonaButtons';
import { PlayerHome } from '@/components/player/PlayerHome';
import { Button } from '@/components/ui';
import { clientApi } from '@/lib/client-api';
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
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-page">
        <Loader2 className="animate-spin text-brand" size={36} />
        <span className="mds-uppercase-label text-fg-subtle">Loading your dashboard…</span>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-page p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-brand/20 bg-brand-soft">
          <ShieldCheck size={34} className="text-brand" />
        </div>
        <div className="max-w-md space-y-3">
          <h1 className="font-brand text-3xl font-bold tracking-tight text-fg">Sign in to see your matches</h1>
          <p className="text-fg-muted">
            Connect with Steam to view your team, seat assignment, and one-click join links.
          </p>
        </div>
        <Button onClick={() => signIn('steam')}>
          <Zap size={15} />
          Continue with Steam
        </Button>
        <MockPersonaButtons callbackUrl="/dashboard" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-page p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-danger/20 bg-danger/10">
          <AlertTriangle size={32} className="text-danger" />
        </div>
        <div className="max-w-md space-y-2">
          <h1 className="font-brand text-2xl font-bold tracking-tight">Couldn&apos;t load your dashboard</h1>
          <p className="text-fg-muted">{error instanceof Error ? error.message : 'Please try again in a moment.'}</p>
        </div>
        <Button variant="secondary" onClick={() => void refetch()}>Retry</Button>
      </div>
    );
  }

  return <PlayerHome user={session?.user} profile={profile} />;
}
