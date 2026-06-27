"use client";

import React from "react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { Users, ArrowRight, Loader2, Search, Gamepad2, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { getGameMetadata } from "@/lib/games";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { clientApi } from "@/lib/client-api";
import { Card, Badge, EmptyState, TopNav } from "@/components/ui";

const PUBLIC_NAV = [{ href: "/tournaments", label: "Tournaments" }];

export default function TournamentsOverviewClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchQuery = searchParams.get("search") || "";

  const { data, isLoading } = useQuery({
    queryKey: ["tournaments"],
    queryFn: async () => clientApi.getTournaments("all"),
    staleTime: 60 * 1000,
  });

  const tournaments = data?.tournaments || [];

  const handleSearch = (term: string) => {
    const params = new URLSearchParams(searchParams);
    if (term) params.set("search", term);
    else params.delete("search");
    router.replace(`${pathname}?${params.toString()}`);
  };

  const filtered = tournaments.filter(
    (t: any) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.game.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-page text-fg">
      <TopNav
        links={PUBLIC_NAV}
        right={
          <Link
            href="/dashboard"
            className="hidden items-center gap-1.5 text-xs font-semibold text-fg-muted transition-colors hover:text-fg sm:flex"
          >
            <LayoutDashboard size={14} />
            My desk
          </Link>
        }
      />

      <main className="mds-container space-y-8 py-10">
        {/* Header */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="mds-uppercase-label text-brand">Tournament directory</p>
            <h1 className="mt-2 font-brand text-4xl font-bold tracking-tight md:text-5xl">
              Discover <span className="text-brand">tournaments</span>
            </h1>
            <p className="mt-3 text-base text-fg-muted">
              Browse live and upcoming events, track brackets in real time, and jump into the ones you care about.
            </p>
          </div>
          <div className="relative w-full lg:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
            <input
              type="text"
              placeholder="Filter tournaments…"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="mds-input pl-9"
            />
          </div>
        </div>

        {/* Count */}
        <div className="flex items-center gap-3 border-b border-line pb-4">
          <h2 className="mds-uppercase-label text-fg-subtle">Active tournaments</h2>
          <Badge tone="neutral">{isLoading ? "…" : `${filtered.length} listed`}</Badge>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-32">
            <Loader2 className="h-8 w-8 animate-spin text-brand" />
            <p className="mds-uppercase-label text-fg-subtle">Loading tournaments…</p>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Gamepad2 size={26} />}
            title={searchQuery ? "No results found" : "No active tournaments"}
            description={searchQuery ? "No tournament matched your search." : "No tournaments are available yet."}
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((t: any, index: number) => {
              const gameMeta = getGameMetadata(t.game);
              return (
                <Link key={t.id} href={`/tournaments/${t.id}`}>
                  <Card interactive className="flex h-full flex-col overflow-hidden p-0">
                    <div className="relative h-40 w-full overflow-hidden border-b border-line">
                      {gameMeta?.bannerUrl && (
                        <Image
                          src={gameMeta.bannerUrl}
                          alt={t.game}
                          fill
                          className="object-cover opacity-50 transition-all duration-500 hover:opacity-90"
                          style={{ objectPosition: gameMeta?.bannerPosition || "center" }}
                          priority={index < 3}
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                      <div className="absolute left-4 top-4">
                        <Badge tone="neutral">{gameMeta?.name || t.game}</Badge>
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col justify-between gap-5 p-5">
                      <div>
                        <h3 className="font-brand text-xl font-bold leading-tight">{t.name}</h3>
                        <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-fg-muted">
                          <Users size={13} className="text-brand" />
                          {t.teamSize}v{t.teamSize} roster
                        </div>
                      </div>
                      <div className="flex items-center justify-between border-t border-line pt-4">
                        <span className="text-sm font-semibold">Open tournament</span>
                        <ArrowRight size={16} className="text-fg-subtle" />
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      <footer className="mt-8 border-t border-line py-8">
        <div className="mds-container flex items-center justify-between">
          <span className="font-brand text-sm font-bold">
            Apex<span className="text-brand">Play</span>
          </span>
          <p className="mds-uppercase-label text-fg-subtle">Tournament directory</p>
        </div>
      </footer>
    </div>
  );
}
