"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { TopNav } from "@/components/ui";

// OBS capture pages (/bracket/[id]/overlay, /roster) render chrome-less (transparent).
const NO_CHROME_PREFIXES = ["/bracket"];

export default function NavigationWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const noChrome = NO_CHROME_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (noChrome) {
    return <>{children}</>;
  }

  // One persistent header for the whole app — it stays mounted across navigations.
  return (
    <>
      <TopNav />
      {children}
    </>
  );
}
