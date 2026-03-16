import React, { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import TournamentManageClient from "@/components/TournamentManageClient";
import { getTournamentWithTeams, getMatches, getScoreboard } from "@/lib/api";
import { Loader2 } from "lucide-react";
import prisma from "@/lib/prisma";

export default async function TournamentManagePage({ params }: { params: { id: string } }) {
  const queryClient = getQueryClient();
  const { id } = params;

  // Prefetch data on the server
  try {
      await Promise.all([
          queryClient.prefetchQuery({
              queryKey: ['tournaments'],
              queryFn: async () => {
                  const tournaments = await prisma.tournament.findMany({
                      orderBy: { createdAt: 'desc' }
                  });
                  return { tournaments };
              }
          }),
          queryClient.prefetchQuery({
              queryKey: ['teams', id],
              queryFn: () => getTournamentWithTeams(id).then(t => t?.teams || [])
          }),
          queryClient.prefetchQuery({
              queryKey: ['matches', id],
              queryFn: () => getMatches(id)
          }),
          queryClient.prefetchQuery({
              queryKey: ['scoreboard', id],
              queryFn: () => getScoreboard(id)
          })
      ]);
  } catch (error) {
      console.error("Prefetch error:", error);
  }

  return (
    <Suspense fallback={
        <div className="min-h-screen bg-[#0d0f12] flex items-center justify-center">
            <div className="flex flex-col items-center gap-6">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 animate-pulse">Initializing Management System...</p>
            </div>
        </div>
    }>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <TournamentManageClient tournamentId={id} />
      </HydrationBoundary>
    </Suspense>
  );
}
