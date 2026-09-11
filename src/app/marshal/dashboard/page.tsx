"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Users, MapPin, Bell, Check, RefreshCw, Loader2, Megaphone, Play } from "lucide-react";
import { clientApi } from "@/lib/client-api";
import { Card, Badge, StatusBadge, Button, EmptyState } from "@/components/ui";
import { useMatchStream } from "@/hooks/useMatchStream";
import { isCalled, isDone, isLive } from "@/lib/match-status";

/** Fallback poll for the match list — the SSE stream is the live path, this only heals gaps. */
const MATCH_REFRESH_MS = 30000;
/** The notification feed has no stream of its own, so it stays polled (slowly). */
const NOTIFICATION_REFRESH_MS = 15000;

/**
 * Matches that need a marshal on the floor, most urgent first. Called first (those are the
 * players who have to be found and walked to a station), then live, then everything still
 * pending. Derived from the shared status sets so a new status can't silently sort last.
 */
const urgency = (status: string | null | undefined) =>
  isCalled(status) ? 0 : isLive(status) ? 1 : 2;

const byUrgency = (a: any, b: any) =>
  urgency(a.status) - urgency(b.status) ||
  (a.round ?? 0) - (b.round ?? 0) ||
  (a.matchOrder ?? 0) - (b.matchOrder ?? 0);

/** Check-in state keyed by player id: an ISO timestamp when at seat, null when not. */
type CheckinMap = Record<string, string | null>;

function checkinsFromMatches(matches: any[]): CheckinMap {
  const map: CheckinMap = {};
  for (const match of matches) {
    for (const side of ["homeTeam", "awayTeam"] as const) {
      for (const player of match?.[side]?.players || []) {
        map[player.id] = player.checkedInAt ? String(player.checkedInAt) : null;
      }
    }
  }
  return map;
}

function PlayerSeatRow({
  player,
  atSeat,
  saving,
  onToggle,
}: {
  player: any;
  atSeat: boolean;
  saving: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={saving}
      aria-pressed={atSeat}
      data-testid={`marshal-player-${player.id}`}
      className={`flex w-full items-center gap-3 rounded-sm border px-3 py-2 text-left transition-all disabled:opacity-60 ${
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
      {saving ? (
        <Loader2 size={15} className="animate-spin text-fg-subtle" />
      ) : atSeat ? (
        <Check size={16} className="text-success" />
      ) : (
        <MapPin size={15} className="text-fg-subtle" />
      )}
    </button>
  );
}

function TeamColumn({
  team,
  isAtSeat,
  isSaving,
  onToggle,
  label,
}: {
  team: any;
  isAtSeat: (player: any) => boolean;
  isSaving: (playerId: string) => boolean;
  onToggle: (player: any) => void;
  label: string;
}) {
  const players = team?.players || [];
  const seated = players.filter((p: any) => isAtSeat(p)).length;
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
              atSeat={isAtSeat(p)}
              saving={isSaving(p.id)}
              onToggle={() => onToggle(p)}
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
  const [tournamentId, setTournamentId] = useState<string | null>(null);
  const [allMatches, setAllMatches] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // Check-in lives on Player.checkedInAt (shared between marshals, survives a reload). This map
  // is the local view of it: seeded from the matches payload, then moved by optimistic toggles
  // and by `player:checkin` events from the tournament stream.
  const [checkins, setCheckins] = useState<CheckinMap>({});
  const [savingPlayers, setSavingPlayers] = useState<string[]>([]);
  const [busyMatch, setBusyMatch] = useState<string | null>(null);
  // Players with a toggle in flight must not be stomped by a refetch that raced the write.
  const savingPlayersRef = useRef<string[]>([]);
  savingPlayersRef.current = savingPlayers;

  const applyMatches = useCallback((matchList: any[]) => {
    setAllMatches(matchList);
    const fresh = checkinsFromMatches(matchList);
    setCheckins((prev) => {
      const next = { ...fresh };
      for (const id of savingPlayersRef.current) {
        if (id in prev) next[id] = prev[id];
      }
      return next;
    });
  }, []);

  const refreshMatches = useCallback(
    async (id: string) => {
      const matchData = await clientApi.getMatches(id);
      applyMatches(matchData || []);
    },
    [applyMatches]
  );

  const refreshNotifications = useCallback(async (id: string) => {
    const response = await clientApi.getNotifications(id);
    setNotifications(response?.notifications || []);
  }, []);

  // Resolve the tournament the floor is running, then load its matches + notification feed once.
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const tournamentResponse = await clientApi.getTournaments("all");
        const tournaments = tournamentResponse?.tournaments || [];
        const activeTournament =
          tournaments.find((t: any) => (t._count?.matches || 0) > 0) || tournaments[0];

        if (!activeTournament) {
          if (!cancelled) {
            setTournamentId(null);
            applyMatches([]);
            setNotifications([]);
          }
        } else {
          const [matchData, notificationResponse] = await Promise.all([
            clientApi.getMatches(activeTournament.id),
            clientApi.getNotifications(activeTournament.id),
          ]);
          if (!cancelled) {
            setTournamentId(activeTournament.id);
            applyMatches(matchData || []);
            setNotifications(notificationResponse?.notifications || []);
          }
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

    void load();
    return () => {
      cancelled = true;
    };
  }, [applyMatches]);

  // Live updates: match rows and check-ins both arrive on the tournament stream.
  useMatchStream(tournamentId, (data) => {
    if (data?.type === "player:checkin") {
      if (!data.playerId) return;
      const playerId = data.playerId as string;
      // A local write still in flight owns the row until its response lands.
      if (savingPlayersRef.current.includes(playerId)) return;
      setCheckins((prev) => ({
        ...prev,
        [playerId]: data.checkedInAt ? String(data.checkedInAt) : null,
      }));
      return;
    }

    if (!data?.matchId || !data?.match) return;
    setAllMatches((prev) => {
      const index = prev.findIndex((m) => m.id === data.matchId);
      if (index === -1) return [...prev, data.match];
      const next = [...prev];
      next[index] = { ...next[index], ...data.match };
      return next;
    });
  });

  // Slow fallback refetch — SSE carries the live changes, this heals a dropped connection.
  useEffect(() => {
    if (!tournamentId) return;
    const interval = setInterval(() => {
      void refreshMatches(tournamentId).catch(() => {
        /* the stream is the live path; a failed heal is not worth a banner */
      });
    }, MATCH_REFRESH_MS);
    return () => clearInterval(interval);
  }, [tournamentId, refreshMatches]);

  // The notification log has no stream, so it keeps a (slow) poll.
  useEffect(() => {
    if (!tournamentId) return;
    const interval = setInterval(() => {
      void refreshNotifications(tournamentId).catch(() => {});
    }, NOTIFICATION_REFRESH_MS);
    return () => clearInterval(interval);
  }, [tournamentId, refreshNotifications]);

  const matches = useMemo(
    () => allMatches.filter((m: any) => !isDone(m.status)).sort(byUrgency),
    [allMatches]
  );

  // The local map wins when it knows the player (it is the freshest), else the row's own field —
  // SSE match frames don't carry `checkedInAt`, so a match first seen on the stream falls back to
  // "not at seat" until the next fallback refetch.
  const isAtSeat = useCallback(
    (player: any) =>
      player.id in checkins ? Boolean(checkins[player.id]) : Boolean(player.checkedInAt),
    [checkins]
  );

  const isSaving = useCallback(
    (playerId: string) => savingPlayers.includes(playerId),
    [savingPlayers]
  );

  /** Optimistic at-seat toggle, persisted for every marshal; reverts if the write fails. */
  const toggleAtSeat = useCallback(
    async (player: any) => {
      const playerId = player.id;
      if (savingPlayersRef.current.includes(playerId)) return;
      const wasAtSeat = playerId in checkins ? Boolean(checkins[playerId]) : Boolean(player.checkedInAt);
      const nextValue = !wasAtSeat;
      const previous = playerId in checkins ? checkins[playerId] : player.checkedInAt ?? null;

      setActionError(null);
      setCheckins((prev) => ({ ...prev, [playerId]: nextValue ? new Date().toISOString() : null }));
      setSavingPlayers((prev) => [...prev, playerId]);

      try {
        const response = await clientApi.setPlayerCheckin(playerId, nextValue);
        const confirmed = response?.player?.checkedInAt ?? null;
        setCheckins((prev) => ({ ...prev, [playerId]: confirmed ? String(confirmed) : null }));
      } catch (err) {
        setCheckins((prev) => ({ ...prev, [playerId]: previous ? String(previous) : null }));
        setActionError(
          err instanceof Error ? `Check-in failed: ${err.message}` : "Check-in failed"
        );
      } finally {
        setSavingPlayers((prev) => prev.filter((id) => id !== playerId));
      }
    },
    [checkins]
  );

  const mergeMatch = useCallback((matchId: string, patch: any) => {
    setAllMatches((prev) => prev.map((m) => (m.id === matchId ? { ...m, ...patch } : m)));
  }, []);

  /** "Call match" — READY + push/Discord/in-app notification for both rosters. */
  const callMatch = useCallback(
    async (match: any) => {
      setActionError(null);
      setBusyMatch(match.id);
      try {
        const response = await clientApi.callMatch(match.id);
        mergeMatch(match.id, response?.match ? { status: response.match.status } : { status: "READY" });
        if (tournamentId) void refreshNotifications(tournamentId).catch(() => {});
      } catch (err) {
        setActionError(
          err instanceof Error ? `Could not call match: ${err.message}` : "Could not call match"
        );
      } finally {
        setBusyMatch(null);
      }
    },
    [mergeMatch, refreshNotifications, tournamentId]
  );

  /** "Mark live" — the teams are seated and the game has started. Scores stay in Control. */
  const markLive = useCallback(
    async (match: any) => {
      setActionError(null);
      setBusyMatch(match.id);
      try {
        const response = await clientApi.setMatchStatus(match.id, "LIVE");
        mergeMatch(match.id, { status: response?.match?.status || "LIVE" });
      } catch (err) {
        setActionError(
          err instanceof Error ? `Could not mark live: ${err.message}` : "Could not mark live"
        );
      } finally {
        setBusyMatch(null);
      }
    },
    [mergeMatch]
  );

  return (
    <div className="min-h-screen bg-page text-fg">
      <main className="mds-container space-y-6 py-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="mds-uppercase-label text-brand">Floor control</p>
            <h1 className="mt-1 font-brand text-3xl font-bold tracking-tight">Marshal board</h1>
            <p className="mt-2 max-w-2xl text-fg-muted">
              Find players by their seat and bring them to station when a match is called. Tap a
              player once they&apos;re seated — every marshal sees it.
            </p>
          </div>
          <span className="hidden items-center gap-2 text-xs font-semibold text-fg-subtle sm:flex">
            <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
            Live stream
          </span>
        </div>

        {error && (
          <Card className="border-danger/30">
            <p className="text-sm font-semibold text-danger">Could not load board</p>
            <p className="mt-1 text-sm text-fg-muted">{error}</p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => window.location.reload()}>
              <RefreshCw size={14} /> Reload
            </Button>
          </Card>
        )}

        {actionError && (
          <Card className="border-danger/30">
            <p className="text-sm font-semibold text-danger">{actionError}</p>
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
                {matches.map((match: any) => {
                  const bothTeams = Boolean(match.homeTeamId && match.awayTeamId);
                  const busy = busyMatch === match.id;
                  const canCall = bothTeams && !isCalled(match.status) && !isLive(match.status);
                  const canGoLive = bothTeams && !isLive(match.status);
                  return (
                    <Card key={match.id} data-testid={`marshal-match-${match.id}`} className="space-y-4">
                      <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
                        <span className="text-xs font-semibold text-fg-subtle">
                          Round {match.round} · #{match.id.slice(0, 4)}
                        </span>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={match.status} />
                          {canCall && (
                            <Button
                              variant="primary"
                              size="sm"
                              disabled={busy}
                              data-testid={`marshal-call-${match.id}`}
                              onClick={() => void callMatch(match)}
                            >
                              {busy ? <Loader2 size={14} className="animate-spin" /> : <Megaphone size={14} />}
                              Call match
                            </Button>
                          )}
                          {canGoLive && (
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={busy}
                              data-testid={`marshal-live-${match.id}`}
                              onClick={() => void markLive(match)}
                            >
                              {busy ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                              Mark live
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        <TeamColumn
                          team={match.homeTeam}
                          label="Team A"
                          isAtSeat={isAtSeat}
                          isSaving={isSaving}
                          onToggle={(p) => void toggleAtSeat(p)}
                        />
                        <TeamColumn
                          team={match.awayTeam}
                          label="Team B"
                          isAtSeat={isAtSeat}
                          isSaving={isSaving}
                          onToggle={(p) => void toggleAtSeat(p)}
                        />
                      </div>
                    </Card>
                  );
                })}
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
