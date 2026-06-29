'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { LogOut, Menu, X } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

export interface NavLink {
  href: string;
  label: string;
}

/**
 * The single, persistent top chrome for the whole app. Rendered once by NavigationWrapper
 * (never per-page) so it doesn't remount/restyle on navigation. Its nav is derived from the
 * signed-in user's role, so it's identical on every surface — only the active item changes.
 */
export function TopNav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const signedIn = status === 'authenticated';
  const user = session?.user as { name?: string; image?: string; role?: string } | undefined;
  const role = user?.role;
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the drawer on navigation.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const links: NavLink[] = [{ href: '/tournaments', label: 'Tournaments' }];
  if (signedIn) links.push({ href: '/dashboard', label: 'My desk' });
  if (role === 'admin') links.push({ href: '/admin', label: 'Admin' });
  if (role === 'admin' || role === 'marshal') links.push({ href: '/marshal/dashboard', label: 'Marshal' });
  if (signedIn) links.push({ href: '/profile', label: 'Profile' });

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
          {signedIn ? (
            <>
              <div className="hidden items-center gap-2 sm:flex">
                {user?.image ? (
                  <Image
                    src={user.image}
                    alt=""
                    width={26}
                    height={26}
                    className="h-6 w-6 rounded-full border border-line"
                  />
                ) : null}
                <span className="hidden text-xs font-semibold text-fg-muted lg:block">{user?.name}</span>
              </div>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="hidden items-center gap-1.5 text-xs font-semibold text-fg-muted transition-colors hover:text-fg lg:flex"
              >
                <LogOut size={14} />
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="hidden text-xs font-semibold text-fg-muted transition-colors hover:text-fg sm:block"
            >
              Sign in
            </Link>
          )}
          <ThemeToggle />
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
            {signedIn ? (
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="mt-1 flex items-center gap-2 rounded-sm px-3 py-2.5 text-left text-sm font-semibold text-fg-muted transition-colors hover:bg-white/5 hover:text-fg"
              >
                <LogOut size={15} />
                Sign out
              </button>
            ) : (
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="rounded-sm px-3 py-2.5 text-sm font-semibold text-fg-muted transition-colors hover:bg-white/5 hover:text-fg"
              >
                Sign in
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
