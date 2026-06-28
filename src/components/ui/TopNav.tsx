'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { LogOut, Menu, X } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

export interface NavLink {
  href: string;
  label: string;
}

/**
 * Shared top chrome for the redesigned surfaces (Public / Player / Control). Renders the
 * brand, surface nav, an optional `right` slot, and the always-present sign-out + theme
 * controls. Each surface supplies its own links so there's exactly one header per surface.
 *
 * Below `md` the nav collapses into a hamburger drawer (nav links + sign-out) so every
 * surface is fully navigable on mobile.
 */
export function TopNav({ links, right }: { links: NavLink[]; right?: React.ReactNode }) {
  const pathname = usePathname();
  const { status } = useSession();
  const signedIn = status === 'authenticated';
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the drawer whenever the route changes (e.g. after tapping a link).
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

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
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-sm px-3 py-1.5 text-sm font-semibold transition-colors ${
                  isActive(l.href) ? 'bg-brand-soft text-brand' : 'text-fg-muted hover:text-fg'
                }`}
              >
                {l.label}
              </Link>
            ))}
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
          {(links.length > 0 || signedIn) && (
            <button
              type="button"
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
              data-testid="mobile-nav-toggle"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center justify-center rounded-sm p-1.5 text-fg-muted transition-colors hover:text-fg md:hidden"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          )}
        </div>
      </div>

      {menuOpen && (
        <nav data-testid="mobile-nav-panel" className="border-t border-line bg-page md:hidden">
          <div className="mds-container flex flex-col gap-1 py-3">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className={`rounded-sm px-3 py-2.5 text-sm font-semibold transition-colors ${
                  isActive(l.href)
                    ? 'bg-brand-soft text-brand'
                    : 'text-fg-muted hover:bg-white/5 hover:text-fg'
                }`}
              >
                {l.label}
              </Link>
            ))}
            {signedIn && (
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="mt-1 flex items-center gap-2 rounded-sm px-3 py-2.5 text-left text-sm font-semibold text-fg-muted transition-colors hover:bg-white/5 hover:text-fg"
              >
                <LogOut size={15} />
                Sign out
              </button>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
