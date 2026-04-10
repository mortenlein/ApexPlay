import React, { Suspense } from "react";
import UserDashboardClient from "@/components/UserDashboardClient";

export default async function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0d0f12] flex items-center justify-center text-gray-500 font-black tracking-[0.2em] uppercase animate-pulse">
        Initializing Competitor Dashboard...
      </div>
    }>
      <UserDashboardClient />
    </Suspense>
  );
}
