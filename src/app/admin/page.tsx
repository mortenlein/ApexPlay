import React, { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import AdminDashboardClient from "@/components/AdminDashboardClient";
import prisma from "@/lib/prisma";
import { requireAdminPage } from "@/lib/route-auth";

export default async function AdminPage() {
  await requireAdminPage("/admin");

  const queryClient = getQueryClient();

  // Prefetch tournaments on the server
  await queryClient.prefetchQuery({
    queryKey: ['tournaments'],
    queryFn: async () => {
      const tournaments = await prisma.tournament.findMany({
        select: {
          id: true,
          name: true,
          game: true,
          category: true,
          format: true,
          teamSize: true,
          createdAt: true,
          updatedAt: true,
          rosterLocked: true,
          steamSignupEnabled: true,
          _count: {
            select: { teams: true, matches: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      return { tournaments };
    },
  });

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0d0f12] flex items-center justify-center text-gray-500 font-black tracking-[0.2em] uppercase animate-pulse">
        Initializing Admin Console...
      </div>
    }>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <AdminDashboardClient />
      </HydrationBoundary>
    </Suspense>
  );
}
