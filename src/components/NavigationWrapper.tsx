"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Header from "./Header";

export default function NavigationWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHud = pathname.startsWith("/hud/");

  if (isHud) {
    return (
      <main className="relative h-screen w-screen overflow-hidden bg-transparent">
        {children}
      </main>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-[var(--mds-page)]">
      <Header />
      <main className="flex-1 pt-16">
        {children}
      </main>
    </div>
  );
}
