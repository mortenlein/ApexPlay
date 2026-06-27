'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { LogOut } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

export interface NavLink {
  href: string;
  label: string;
}

/**
 * Shared top chrome for the redesigned surfaces (Public / Player / Control). Renders the
 * brand, surface nav, an optional `right` slot, and the always-present sign-out + theme
 * controls. Each surface supplies its own links so there's exactly one header per surface.
 */
export function TopNav({ links, right }: { links: NavLink[]; right?: React.ReactNode }) {
  const pathname = usePathname();
  const { status } = useSession();
  const signedIn = status === 'authenticated';

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // best-effort; continue to NextAuth sign-out
    }
    await signOut({ callbackUrl: '/' });
  };

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-page/80 backdrop-blur">
      <div className="mds-container flex h-14 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-brand text-lg font-bold tracking-tight">
            Apex<span className="text-brand">Play</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {links.map((l) => {
              const active = pathname === l.href || pathname.startsWith(l.href + '/');
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`rounded-sm px-3 py-1.5 text-sm font-semibold transition-colors ${
                    active ? 'bg-brand-soft text-brand' : 'text-fg-muted hover:text-fg'
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {right}
          {signedIn && (
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="hidden items-center gap-1.5 text-xs font-semibold text-fg-muted transition-colors hover:text-fg lg:flex"
            >
              <LogOut size={14} />
              Sign out
            </button>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
