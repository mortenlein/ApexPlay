import React, { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import DashboardClient from "@/components/DashboardClient";
import prisma from "@/lib/prisma";

export default async function DashboardPage() {
  const queryClient = getQueryClient();

  // Prefetch tournaments on the server
  await queryClient.prefetchQuery({
    queryKey: ['tournaments'],
    queryFn: async () => {
      const tournaments = await prisma.tournament.findMany({
        orderBy: { createdAt: 'desc' },
      });
      return { tournaments };
    },
  });

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0d0f12] flex items-center justify-center text-gray-500 font-black tracking-[0.2em] uppercase animate-pulse">
        Syncing Command Center...
      </div>
    }>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <DashboardClient />
      </HydrationBoundary>
    </Suspense>
  );
}
