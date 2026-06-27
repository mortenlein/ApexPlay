"use client";

import React, { useState, useEffect } from "react";
import { Users, MapPin, Bell, Check, RefreshCw, Loader2 } from "lucide-react";
import { clientApi } from "@/lib/client-api";
import { Card, Badge, StatusBadge, Button, EmptyState, TopNav } from "@/components/ui";

const CONTROL_NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/marshal/dashboard", label: "Marshal" },
  { href: "/tournaments", label: "Public site" },
];

// Matches that need a marshal on the floor, most urgent first.
const STATUS_PRIORITY: Record<string, number> = {
  WAITING_FOR_PLAYERS: 0,
  READY: 1,
  LIVE: 2,
  IN_PROGRESS: 2,
  PENDING: 3,
};

function PlayerSeatRow({
  player,
  atSeat,
  onToggle,
}: {
  player: any;
  atSeat: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-center gap-3 rounded-sm border px-3 py-2 text-left transition-all ${
        atSeat
          ? "border-success/40 bg-success/10"
          : "border-line bg-field hover:border-line-hover"
      }`}
    >
      <span
        className={`min-w-[3.25rem] rounded-sm px-2 py-1 text-center font-mono text-sm font-bold ${
          player.seating ? "bg-brand-soft text-brand" : "bg-white/5 text-fg-subtle"
        }`}
      >
        {player.seating || "—"}
      </span>
      <span className="flex-1 truncate text-sm font-semibold">
        {player.nickname || player.name?.split(" ")[0] || "Player"}
      </span>
      {atSeat ? (
        <Check size={16} className="text-success" />
      ) : (
        <MapPin size={15} className="text-fg-subtle" />
      )}
    </button>
  );
}

function TeamColumn({
  team,
  atSeatStatus,
  onToggle,
  label,
}: {
  team: any;
  atSeatStatus: Record<string, boolean>;
  onToggle: (id: string) => void;
  label: string;
}) {
  const players = team?.players || [];
  const seated = players.filter((p: any) => atSeatStatus[p.id]).length;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold">{team?.name || label}</span>
        {players.length > 0 && (
          <span
            className={`text-xs font-semibold ${
              seated === players.length ? "text-success" : "text-fg-muted"
            }`}
          >
            {seated}/{players.length} at seat
          </span>
        )}
      </div>
      {players.length > 0 ? (
        <div className="space-y-1.5">
          {players.map((p: any) => (
            <PlayerSeatRow
              key={p.id}
              player={p}
              atSeat={Boolean(atSeatStatus[p.id])}
              onToggle={() => onToggle(p.id)}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-sm border border-dashed border-line px-3 py-2 text-xs text-fg-subtle">
          Roster not set
        </p>
      )}
    </div>
  );
}

export default function MarshalDashboard() {
  const [matches, setMatches] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [atSeatStatus, setAtSeatStatus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        const tournamentResponse = await clientApi.getTournaments("all");
        const tournaments = tournamentResponse?.tournaments || [];
        const activeTournament =
          tournaments.find((t: any) => (t._count?.matches || 0) > 0) || tournaments[0];

        if (activeTournament) {
          const [matchData, notificationResponse] = await Promise.all([
            clientApi.getMatches(activeTournament.id),
            clientApi.getNotifications(activeTournament.id),
          ]);
          if (!cancelled) {
            const open = matchData
              .filter((m: any) => m.status !== "COMPLETED" && m.status !== "FINISHED")
              .sort(
                (a: any, b: any) =>
                  (STATUS_PRIORITY[a.status] ?? 9) - (STATUS_PRIORITY[b.status] ?? 9)
              );
            setMatches(open);
            setNotifications(notificationResponse.notifications || []);
          }
        } else if (!cancelled) {
          setMatches([]);
          setNotifications([]);
        }
        if (!cancelled) {
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load marshal board");
          setLoading(false);
        }
      }
    };

    void fetchData();
    const interval = setInterval(() => void fetchData(), 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const toggleAtSeat = (playerId: string) =>
    setAtSeatStatus((prev) => ({ ...prev, [playerId]: !prev[playerId] }));

  return (
    <div className="min-h-screen bg-page text-fg">
      <TopNav links={CONTROL_NAV} />
      <main className="mds-container space-y-6 py-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="mds-uppercase-label text-brand">Floor control</p>
            <h1 className="mt-1 font-brand text-3xl font-bold tracking-tight">Marshal board</h1>
            <p className="mt-2 max-w-2xl text-fg-muted">
              Find players by their seat and bring them to station when a match is called. Tap a
              player once they&apos;re seated.
            </p>
          </div>
          <span className="hidden items-center gap-2 text-xs font-semibold text-fg-subtle sm:flex">
            <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
            Live · refreshes every 3s
          </span>
        </div>

        {error && (
          <Card className="border-danger/30">
            <p className="text-sm font-semibold text-danger">Could not refresh board</p>
            <p className="mt-1 text-sm text-fg-muted">{error}</p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => window.location.reload()}>
              <RefreshCw size={14} /> Reload
            </Button>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="animate-spin text-brand" size={28} />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <h2 className="mds-uppercase-label text-fg-subtle">Matches needing players</h2>
              <Badge tone="neutral">{matches.length}</Badge>
            </div>

            {matches.length === 0 ? (
              <EmptyState
                icon={<Users size={26} />}
                title="No open matches"
                description="When a match is called, its teams and seats appear here."
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {matches.map((match: any) => (
                  <Card key={match.id} data-testid={`marshal-match-${match.id}`} className="space-y-4">
                    <div className="flex items-center justify-between border-b border-line pb-3">
                      <span className="text-xs font-semibold text-fg-subtle">
                        Round {match.round} · #{match.id.slice(0, 4)}
                      </span>
                      <StatusBadge status={match.status} />
                    </div>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <TeamColumn team={match.homeTeam} label="Team A" atSeatStatus={atSeatStatus} onToggle={toggleAtSeat} />
                      <TeamColumn team={match.awayTeam} label="Team B" atSeatStatus={atSeatStatus} onToggle={toggleAtSeat} />
                    </div>
                  </Card>
                ))}
              </div>
            )}

            <section className="space-y-3 pt-2">
              <div className="flex items-center gap-2">
                <Bell size={15} className="text-brand" />
                <h2 className="mds-uppercase-label text-fg-subtle">Match calls</h2>
              </div>
              {notifications.length === 0 ? (
                <p className="rounded-sm border border-dashed border-line px-4 py-3 text-sm text-fg-subtle">
                  No alerts yet.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {notifications.slice(0, 8).map((n: any) => (
                    <div
                      key={n.id}
                      data-testid="notification-entry"
                      className="rounded-sm border border-line bg-field px-4 py-3"
                    >
                      <div className="flex items-center justify-between">
                        <Badge tone={n.type === "RESULT" ? "ready" : "info"}>{n.type}</Badge>
                        <span className="text-xs text-fg-subtle">
                          {new Date(n.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-semibold">{n.embed?.title}</p>
                      {n.embed?.description && (
                        <p className="text-xs text-fg-muted">{n.embed.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
