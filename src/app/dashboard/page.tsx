import React, { Suspense } from "react";
import UserDashboardClient from "@/components/UserDashboardClient";

export default async function DashboardPage() {
  return (
    <Suspense
      fallback={
        // Desk-shaped, not a full-screen message: the shell that is about to appear.
        <div className="min-h-screen bg-page">
          <main className="mds-container space-y-6 py-6 sm:py-8" aria-busy="true">
            <p className="mds-uppercase-label text-fg-subtle">Player desk</p>
            <div className="h-40 animate-pulse rounded-lg border border-line bg-card" />
          </main>
        </div>
      }
    >
      <UserDashboardClient />
    </Suspense>
  );
}
