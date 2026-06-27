"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Header from "./Header";

// Surfaces that render their own top chrome (via ui/TopNav) — the global header is
// suppressed there so there's exactly one header per surface.
// Every surface now renders its own chrome via ui/TopNav, so the global Header is only a
// fallback for any stray/legacy route.
const SELF_CHROME_PREFIXES = ["/dashboard", "/tournaments", "/bracket", "/login", "/marshal", "/admin"];

export default function NavigationWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const selfChrome = SELF_CHROME_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (selfChrome) {
    return <>{children}</>;
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-[var(--mds-page)]">
      <Header />
      <main className="flex-1 pt-16">{children}</main>
    </div>
  );
}
