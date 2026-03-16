import React, { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { getTournament, getTournamentWithTeams, getMatches, getScoreboard } from "@/lib/api";
import TournamentView from "@/components/TournamentView";
import TournamentSkeleton from "@/components/TournamentSkeleton";

export default async function TournamentPage({ params }: { params: { id: string } }) {
  const queryClient = getQueryClient();

  // Prefetch data on the server
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ['tournament', params.id],
      queryFn: () => getTournament(params.id),
    }),
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
