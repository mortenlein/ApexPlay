"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, Gamepad2 } from "lucide-react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { getGameMetadata, teamSizeLabel } from "@/lib/games";
import { clientApi } from "@/lib/client-api";
import { STAGE_META, STAGE_ORDER, type TournamentStage } from "@/lib/tournament-stage";
import { Badge, EmptyState, PageHeader, TournamentCard } from "@/components/ui";

// Same tone map the landing page uses for its stage badges (src/app/page.tsx), so a
// tournament reads identically on both boards.
const STAGE_TONE: Record<TournamentStage, "neutral" | "info" | "live" | "done"> = {
  DRAFT: "neutral",
  REGISTRATION: "info",
  LIVE: "live",
  COMPLETE: "done",
};

interface DirectoryRow {
  id: string;
  name: string;
  game: string;
  format?: string | null;
  teamSize: number;
  stage?: string | null;
  _count?: { teams?: number; matches?: number };
}

export default function TournamentsOverviewClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchQuery = searchParams.get("search") || "";
  const stageFilter = (searchParams.get("stage") || "").toUpperCase();

  const { data, isLoading } = useQuery({
    queryKey: ["tournaments"],
    queryFn: async () => clientApi.getTournaments("all"),
    staleTime: 60 * 1000,
  });

  const tournaments: DirectoryRow[] = data?.tournaments || [];

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const matchesSearch = (t: DirectoryRow) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.game.toLowerCase().includes(searchQuery.toLowerCase());

  const searched = tournaments.filter(matchesSearch);
  const filtered = stageFilter
    ? searched.filter((t) => String(t.stage || "").toUpperCase() === stageFilter)
    : searched;

  // Counts come from the data, so a filter is never offered for a bucket that is empty.
  const stageCounts = STAGE_ORDER.map((stage) => ({
    stage,
    count: searched.filter((t) => String(t.stage || "").toUpperCase() === stage).length,
  })).filter((s) => s.count > 0);

  const liveCount = stageCounts.find((s) => s.stage === "LIVE")?.count ?? 0;

  // Board order, not lifecycle order: what is being played outranks what someone might sign up
  // for, which outranks a draft nobody can enter, which outranks a tournament already decided.
  const BOARD_ORDER: TournamentStage[] = ["LIVE", "REGISTRATION", "DRAFT", "COMPLETE"];
  const rank = (t: DirectoryRow) => {
    const i = BOARD_ORDER.indexOf(String(t.stage || "DRAFT").toUpperCase() as TournamentStage);
    return i === -1 ? BOARD_ORDER.length : i;
  };
  const cards = [...filtered].sort((a, b) => rank(a) - rank(b));

  return (
    <div className="flex min-h-screen flex-col bg-page text-fg">
      <PageHeader
        eyebrow="Directory"
        title="Tournaments"
        subtitle="Every tournament on this server: what is being played now, what is open for sign-up, and what is already decided."
        meta={
          liveCount > 0 ? (
            <span className="inline-flex items-center gap-2 text-body font-semibold text-live">
              <span className="mds-dot is-live" aria-hidden />
              <span className="mds-tabular">{liveCount}</span>
              &nbsp;{liveCount === 1 ? "tournament is running right now" : "tournaments are running right now"}
            </span>
          ) : undefined
        }
        actions={
          <div className="relative w-full sm:w-72">
            <label htmlFor="directory-filter" className="sr-only">
              Filter tournaments
            </label>
            <Search
              size={15}
              aria-hidden
              className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle"
            />
            <input
              id="directory-filter"
              type="search"
              placeholder="Filter tournaments…"
              value={searchQuery}
              onChange={(e) => setParam("search", e.target.value)}
              className="mds-input pl-9"
            />
          </div>
        }
      />

      <main className="mds-container flex-1 space-y-6 py-8">
        <div className="mds-section-head">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mds-uppercase-label mr-1 text-fg">Board</h2>
            <FilterChip label="All" count={searched.length} active={!stageFilter} onClick={() => setParam("stage", "")} />
            {stageCounts.map(({ stage, count }) => (
              <FilterChip
                key={stage}
                label={STAGE_META[stage].label}
                count={count}
                tone={stage === "LIVE" ? "live" : undefined}
                active={stageFilter === stage}
                onClick={() => setParam("stage", stageFilter === stage ? "" : stage)}
              />
            ))}
          </div>
          <Badge tone="neutral">
            {isLoading ? "…" : (
              <>
                <span className="mds-tabular">{filtered.length}</span>&nbsp;listed
              </>
            )}
          </Badge>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-32">
            <Loader2 className="h-8 w-8 animate-spin text-brand" aria-hidden />
            <p className="mds-uppercase-label text-fg-subtle">Loading tournaments…</p>
          </div>
        ) : cards.length === 0 ? (
          <EmptyState
            icon={<Gamepad2 size={24} />}
            title={searchQuery || stageFilter ? "No results found" : "No tournaments yet"}
            description={
              searchQuery || stageFilter
                ? "No tournament matched that filter. Clear it to see the whole board."
                : "Nothing has been created on this server yet."
            }
          />
        ) : (
          <ul className="mds-card-grid">
            {cards.map((t) => {
              const gameMeta = getGameMetadata(t.game);
              // `stage` is derived server-side (GET /api/tournaments and the SSR prefetch).
              const stage: TournamentStage | null =
                t.stage && t.stage in STAGE_META ? (t.stage as TournamentStage) : null;
              return (
                <li key={t.id}>
                  <TournamentCard
                    href={`/tournaments/${t.id}`}
                    name={t.name}
                    game={gameMeta?.name || t.game}
                    format={t.format === "DOUBLE_ELIMINATION" ? "Double elim" : "Single elim"}
                    roster={teamSizeLabel(gameMeta, t.teamSize)}
                    teamCount={t._count?.teams ?? 0}
                    stageLabel={stage ? STAGE_META[stage].label : "Draft"}
                    stageTone={stage ? STAGE_TONE[stage] : "neutral"}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <footer className="border-t border-line py-6">
        <div className="mds-container flex items-center justify-between">
          <span className="font-brand text-body font-bold">
            Apex<span className="text-brand">Play</span>
          </span>
          <p className="mds-uppercase-label text-fg-subtle">Tournament directory</p>
        </div>
      </footer>
    </div>
  );
}

/** A stage filter. Only rendered for stages that actually have tournaments in them. */
function FilterChip({
  label,
  count,
  active,
  tone,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  tone?: "live";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`mds-badge border transition-colors ${
        active
          ? "border-brand-line bg-brand-soft text-brand"
          : tone === "live"
            ? "border-live/40 bg-tint text-live hover:bg-tint-strong"
            : "border-line bg-tint text-fg-muted hover:bg-tint-strong hover:text-fg"
      }`}
    >
      {label}
      <span className="mds-tabular opacity-60">{count}</span>
    </button>
  );
}
