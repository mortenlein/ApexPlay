import React, { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import TournamentsOverviewClient from "@/components/TournamentsOverviewClient";
import prisma from "@/lib/prisma";
import { Loader2 } from "lucide-react";

export default async function TournamentsOverview() {
  const queryClient = getQueryClient();

  // Prefetch the initial tournament list
  await queryClient.prefetchQuery({
    queryKey: ['tournaments'],
    queryFn: async () => {
      // Direct prisma fetch for the server-side prefetch
      const tournaments = await prisma.tournament.findMany({
          orderBy: { createdAt: 'desc' },
          select: {
              id: true,
              name: true,
              game: true,
              teamSize: true,
              format: true,
              createdAt: true
          }
      });
      return { tournaments };
    }
  });

  return (
    <Suspense fallback={
        <div className="min-h-screen bg-[#0d0f12] flex items-center justify-center">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
        </div>
    }>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <TournamentsOverviewClient />
      </HydrationBoundary>
    </Suspense>
  );
}
