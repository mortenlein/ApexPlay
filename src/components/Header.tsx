"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Trophy, LayoutDashboard, Shield, Radio, User, Menu, X, Command, LogOut } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import { NavItem, isActivePath } from "@/lib/navigation";
import { openCommandPalette } from "@/components/CommandPalette";

function getHeaderItems(pathname: string, signedIn: boolean): NavItem[] {
  const base: NavItem[] = [
    { href: "/tournaments", label: "Tournaments", icon: Trophy, matchMode: "prefix" },
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, matchMode: "prefix" },
  ];

  if (signedIn) {
    base.push({ href: "/profile", label: "Profile", icon: User, matchMode: "prefix" });
  }

  if (pathname.startsWith("/admin")) {
    base.push({ href: "/admin", label: "Admin", icon: Shield, matchMode: "prefix" });
    base.push({ href: "/marshal/dashboard", label: "Marshal", icon: Radio, matchMode: "prefix" });
  }

  if (pathname.startsWith("/marshal")) {
    base.push({ href: "/marshal/dashboard", label: "Marshal", icon: Radio, matchMode: "prefix" });
    base.push({ href: "/admin", label: "Admin", icon: Shield, matchMode: "prefix" });
  }

  if (!pathname.startsWith("/admin") && !pathname.startsWith("/marshal")) {
    base.push({ href: "/admin", label: "Admin", icon: Shield, matchMode: "prefix" });
  }

  const seen = new Set<string>();
  return base.filter((item) => {
    if (seen.has(item.href)) {
      return false;
    }

    seen.add(item.href);
    return true;
  });
}

export default function Header() {
  const pathname = usePathname();
  const { status } = useSession();
  const signedIn = status === "authenticated";
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const items = React.useMemo(() => getHeaderItems(pathname, signedIn), [pathname, signedIn]);
  const canSignOut = signedIn || pathname.startsWith("/admin") || pathname.startsWith("/marshal");

  const handleSignOut = React.useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Best effort admin-cookie cleanup; continue with NextAuth sign-out.
    }

    await signOut({ callbackUrl: "/" });
  }, []);

  return (
    <header className="fixed left-0 right-0 top-0 z-[100] h-16 border-b border-[var(--mds-border)] bg-[var(--mds-page)]/95 backdrop-blur-md transition-all">
      <div className="mx-auto flex h-full max-w-mds-content items-center justify-between px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="group flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-mds-comfortable bg-[var(--mds-action)] text-[var(--mds-near-white)] shadow-mds-whisper transition-all group-hover:scale-105">
              <Trophy size={18} strokeWidth={2.5} />
            </div>
            <span className="font-brand text-xl font-bold tracking-tight text-[var(--mds-text-primary)]">ApexPlay</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = isActivePath(pathname, item.href, item.matchMode || "exact");
              return (
                <Link key={item.href} href={item.href} className={`mds-nav-link ${isActive ? "active" : ""}`}>
                  {Icon ? <Icon size={16} strokeWidth={isActive ? 2.5 : 2} /> : null}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {canSignOut ? (
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="hidden h-9 items-center gap-2 rounded-mds-comfortable border border-[var(--mds-border)] px-3 text-[10px] font-black uppercase tracking-widest text-[var(--mds-text-muted)] transition-all hover:text-[var(--mds-text-primary)] lg:flex"
            >
              <LogOut size={13} />
              Sign out
            </button>
          ) : null}
          <button
            type="button"
            onClick={openCommandPalette}
            className="hidden h-9 items-center gap-2 rounded-mds-comfortable border border-[var(--mds-border)] px-3 text-[10px] font-black uppercase tracking-widest text-[var(--mds-text-muted)] transition-all hover:text-[var(--mds-text-primary)] lg:flex"
          >
            <Command size={13} />
            Command
          </button>

          <div className="h-6 w-px bg-[var(--mds-border)] opacity-30 lg:mx-2" />
          <ThemeToggle />

          <button
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            className="flex p-2 text-[var(--mds-text-muted)] hover:text-[var(--mds-text-primary)] md:hidden"
            aria-label="Toggle mobile menu"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {isMobileMenuOpen ? (
        <div className="absolute inset-x-0 top-16 z-50 border-b border-[var(--mds-border)] bg-[var(--mds-page)] p-6 shadow-xl animate-in fade-in slide-in-from-top-4 duration-200">
          <nav className="flex flex-col gap-2">
            {items.map((item) => {
              const Icon = item.icon;
              const active = isActivePath(pathname, item.href, item.matchMode || "exact");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-4 rounded-mds-comfortable p-4 transition-all ${
                    active
                      ? "bg-[var(--mds-action-soft)] font-bold text-[var(--mds-action)]"
                      : "text-[var(--mds-text-muted)] hover:bg-[var(--mds-page)] active:bg-[var(--mds-action-soft)]"
                  }`}
                >
                  {Icon ? <Icon size={20} /> : null}
                  <span className="text-sm">{item.label}</span>
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => {
                openCommandPalette();
                setIsMobileMenuOpen(false);
              }}
              className="flex items-center gap-4 rounded-mds-comfortable p-4 text-left text-[var(--mds-text-muted)] transition-all hover:bg-[var(--mds-page)]"
            >
              <Command size={20} />
              <span className="text-sm">Command Palette</span>
            </button>
            {canSignOut ? (
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  void handleSignOut();
                }}
                className="flex items-center gap-4 rounded-mds-comfortable p-4 text-left text-[var(--mds-text-muted)] transition-all hover:bg-[var(--mds-page)]"
              >
                <LogOut size={20} />
                <span className="text-sm">Sign out</span>
              </button>
            ) : null}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
