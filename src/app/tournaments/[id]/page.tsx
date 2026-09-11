import React, { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { getTournament, getTournamentWithTeams, getMatches, getScoreboard } from "@/lib/api";
import TournamentView from "@/components/TournamentView";
import TournamentSkeleton from "@/components/TournamentSkeleton";
import { notFound } from "next/navigation";

// The prefetched payload embedded in this HTML is session-dependent (staff see steamIds, invite
// codes, etc.), so this page must be rendered per request and never cached/shared.
export const dynamic = 'force-dynamic';

export default async function TournamentPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const queryClient = getQueryClient();
  const tournament = await getTournament(params.id);

  if (!tournament) {
    notFound();
  }
  queryClient.setQueryData(['tournament', params.id], tournament);

  // Prefetch data on the server
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ['teams', params.id],
      queryFn: () => getTournamentWithTeams(params.id).then(t => t?.teams || []),
    }),
    queryClient.prefetchQuery({
      queryKey: ['matches', params.id],
      queryFn: () => getMatches(params.id),
    }),
    queryClient.prefetchQuery({
      queryKey: ['scoreboard', params.id],
      queryFn: () => getScoreboard(params.id),
    })
  ]);

  return (
    <Suspense fallback={<TournamentSkeleton />}>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <TournamentView id={params.id} />
      </HydrationBoundary>
    </Suspense>
  );
}
