"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Header from "./Header";

export default function NavigationWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="relative flex min-h-screen flex-col bg-[var(--mds-page)]">
      <Header />
      <main className="flex-1 pt-16">
        {children}
      </main>
    </div>
  );
}
