"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Users,
  MapPin,
  Bell,
  Check,
  RefreshCw,
  Loader2,
  Megaphone,
  Play,
  WifiOff,
  X,
  Clock,
} from "lucide-react";
import { clientApi } from "@/lib/client-api";
import { Card, Badge, StatusBadge, Button, EmptyState } from "@/components/ui";
import { useMatchStream } from "@/hooks/useMatchStream";
import { byPlayOrder, isCalled, isDone, isLive } from "@/lib/match-status";
import { notificationText, notificationTitle } from "@/lib/notification-display";

/**
 * Marshal board — the floor tool.
 *
 * A marshal walks the venue with a phone, finds the players of a called match by their seat
 * label, and taps each one once they are seated. The board is optimised for exactly that:
 * called matches first (oldest call at the top), every player row is a big tap target that
 * shows the seat before the name, and the at-seat state is shared live with every other
 * marshal through the tournament SSE stream. Scores are entered in the organizer Control view,
 * not here.
 */

/** Fallback poll for the match list — the SSE stream is the live path, this only heals gaps. */
const MATCH_REFRESH_MS = 30000;
/** The notification feed has no stream of its own, so it stays polled (slowly). */
const NOTIFICATION_REFRESH_MS = 15000;
/** localStorage key for the marshal's chosen tournament (survives reloads on the same phone). */
const TOURNAMENT_STORAGE_KEY = "apexplay.marshal.tournament";

/** Check-in state keyed by player id: an ISO timestamp when at seat, null when not. */
type CheckinMap = Record<string, string | null>;

function checkinsFromMatches(matches: any[]): CheckinMap {
  const map: CheckinMap = {};
  for (const match of matches) {
    for (const side of ["homeTeam", "awayTeam"] as const) {
      for (const player of match?.[side]?.players || []) {
        if (player?.id) map[player.id] = player.checkedInAt ? String(player.checkedInAt) : null;
      }
    }
  }
  return map;
}

/** Seats sort naturally ("A2" before "A10"); players without a seat go last. */
const seatCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
const bySeat = (a: any, b: any) => {
  if (!a.seating && !b.seating) return 0;
  if (!a.seating) return 1;
  if (!b.seating) return -1;
  return seatCollator.compare(String(a.seating), String(b.seating));
};

/** Oldest call first: the team that has waited longest is the one to fetch next. */
const byCalledAt = (a: any, b: any) =>
  new Date(a.updatedAt || 0).getTime() - new Date(b.updatedAt || 0).getTime();
const byBracketOrder = (a: any, b: any) => byPlayOrder(a, b);

function minutesAgo(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((now - t) / 60000));
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
  const t = useTranslations("marshal");
  const tc = useTranslations("common");
  const displayName = player.nickname || player.name?.split(" ")[0] || tc("player");
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={saving}
      aria-pressed={atSeat}
      aria-label={t("playerRow", {
        name: displayName,
        seat: player.seating || t("unknownSeat"),
        state: atSeat ? t("atSeat") : t("notAtSeat"),
      })}
      data-testid={`marshal-player-${player.id}`}
      className={`flex min-h-[3.25rem] w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-all active:scale-[0.99] disabled:opacity-60 ${
        atSeat
          ? "border-success/50 bg-success/10"
          : "border-line bg-field hover:border-line-hover"
      }`}
    >
      <span
        className={`min-w-[3.75rem] rounded-sm px-2 py-1.5 text-center font-mono text-base font-bold tabular-nums ${
          player.seating ? "bg-brand-soft text-brand" : "bg-white/5 text-fg-subtle"
        }`}
      >
        {player.seating || "—"}
      </span>
      <span className="flex-1 truncate text-base font-semibold">{displayName}</span>
      {saving ? (
        <Loader2 size={18} className="animate-spin text-fg-subtle" />
      ) : atSeat ? (
        <Check size={20} className="text-success" />
      ) : (
        <MapPin size={18} className="text-fg-subtle" />
      )}
    </button>
  );
}

function TeamColumn({
  team,
  label,
  isAtSeat,
  isSaving,
  onToggle,
}: {
  team: any;
  label: string;
  isAtSeat: (player: any) => boolean;
  isSaving: (playerId: string) => boolean;
  onToggle: (player: any) => void;
}) {
  const t = useTranslations("marshal");
  const players = useMemo(() => [...(team?.players || [])].sort(bySeat), [team?.players]);
  const seated = players.filter((p: any) => isAtSeat(p)).length;
  const complete = players.length > 0 && seated === players.length;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-bold">{team?.name || label}</span>
        {players.length > 0 && (
          <span className={`shrink-0 text-xs font-semibold ${complete ? "text-success" : "text-fg-muted"}`}>
            {t("atSeatCount", { seated, total: players.length })}
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
          {t("rosterNotSet")}
        </p>
      )}
    </div>
  );
}

function MatchCard({
  match,
  now,
  busy,
  isAtSeat,
  isSaving,
  onToggle,
  onCall,
  onLive,
}: {
  match: any;
  now: number;
  busy: boolean;
  isAtSeat: (player: any) => boolean;
  isSaving: (playerId: string) => boolean;
  onToggle: (player: any) => void;
  onCall: (match: any) => void;
  onLive: (match: any) => void;
}) {
  const t = useTranslations("marshal");
  const called = isCalled(match.status);
  const live = isLive(match.status);
  const canCall = !called && !live;
  const canGoLive = called;
  const players = [...(match.homeTeam?.players || []), ...(match.awayTeam?.players || [])];
  const seated = players.filter((p) => isAtSeat(p)).length;
  const allSeated = players.length > 0 && seated === players.length;
  const calledFor = called ? minutesAgo(match.updatedAt, now) : null;

  return (
    <Card
      data-testid={`marshal-match-${match.id}`}
      className={`space-y-4 ${called ? "border-success/40" : ""} ${live ? "border-danger/30" : ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={match.status} />
          <span className="text-xs font-semibold text-fg-subtle">
            {t("roundShort", { round: match.round })} · #{match.id.slice(0, 4)}
          </span>
          {calledFor !== null && (
            <span
              className={`flex basis-full items-center gap-1 whitespace-nowrap text-xs font-semibold sm:basis-auto ${
                calledFor >= 10 ? "text-warning" : "text-fg-subtle"
              }`}
              title={t("calledSince")}
            >
              <Clock size={12} />{" "}
              {calledFor === 0 ? t("calledJustNow") : t("calledMinutesAgo", { minutes: calledFor })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {players.length > 0 && (called || live) && (
            <span className={`text-xs font-bold ${allSeated ? "text-success" : "text-fg-muted"}`}>
              {t("seatedCount", { seated, total: players.length })}
            </span>
          )}
          {canCall && (
            <Button
              variant="primary"
              size="sm"
              disabled={busy}
              data-testid={`marshal-call-${match.id}`}
              onClick={() => onCall(match)}
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Megaphone size={14} />}
              {t("callMatch")}
            </Button>
          )}
          {canGoLive && (
            <Button
              variant={allSeated ? "primary" : "secondary"}
              size="sm"
              disabled={busy}
              data-testid={`marshal-live-${match.id}`}
              onClick={() => onLive(match)}
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              {t("markLive")}
            </Button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <TeamColumn team={match.homeTeam} label={t("teamA")} isAtSeat={isAtSeat} isSaving={isSaving} onToggle={onToggle} />
        <TeamColumn team={match.awayTeam} label={t("teamB")} isAtSeat={isAtSeat} isSaving={isSaving} onToggle={onToggle} />
      </div>
    </Card>
  );
}

function Section({
  title,
  count,
  tone,
  children,
}: {
  title: string;
  count: number;
  tone: "ready" | "live" | "neutral";
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <h2 className="mds-uppercase-label text-fg-subtle">{title}</h2>
        <Badge tone={count > 0 ? tone : "neutral"}>{count}</Badge>
      </div>
      {children}
    </section>
  );
}

export default function MarshalDashboard() {
  const tNotif = useTranslations("notifications");
  const t = useTranslations("marshal");
  const tc = useTranslations("common");
  const router = useRouter();

  const [tournaments, setTournaments] = useState<any[]>([]);
  const [tournamentId, setTournamentId] = useState<string | null>(null);
  const [allMatches, setAllMatches] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // Check-in lives on Player.checkedInAt (shared between marshals, survives a reload). This map
  // is the local view of it: seeded from every matches payload / stream frame, then moved by
  // optimistic toggles and by `player:checkin` events from the tournament stream.
  const [checkins, setCheckins] = useState<CheckinMap>({});
  const [savingPlayers, setSavingPlayers] = useState<string[]>([]);
  const [busyMatch, setBusyMatch] = useState<string | null>(null);
  // Players with a toggle in flight must not be stomped by a refetch/frame that raced the write.
  const savingPlayersRef = useRef<string[]>([]);
  savingPlayersRef.current = savingPlayers;

  /** Merge fresh server truth into the check-in map, except rows we are mid-write on. */
  const absorbCheckins = useCallback((fresh: CheckinMap) => {
    setCheckins((prev) => {
      const next = { ...prev, ...fresh };
      for (const id of savingPlayersRef.current) {
        if (id in prev) next[id] = prev[id];
      }
      return next;
    });
  }, []);

  const applyMatches = useCallback(
    (matchList: any[]) => {
      setAllMatches(matchList);
      absorbCheckins(checkinsFromMatches(matchList));
      setLastSyncAt(Date.now());
    },
    [absorbCheckins]
  );

  const refreshMatches = useCallback(
    async (id: string) => {
      const matchData = await clientApi.getMatches(id);
      applyMatches(Array.isArray(matchData) ? matchData : []);
    },
    [applyMatches]
  );

  const refreshNotifications = useCallback(async (id: string) => {
    const response = await clientApi.getNotifications(id);
    setNotifications(response?.notifications || []);
  }, []);

  const refreshAll = useCallback(
    async (id: string, { silent = false } = {}) => {
      if (!silent) setRefreshing(true);
      try {
        await Promise.all([refreshMatches(id), refreshNotifications(id)]);
        setError(null);
      } finally {
        if (!silent) setRefreshing(false);
      }
    },
    [refreshMatches, refreshNotifications]
  );

  // Resolve which tournament the floor is running: ?t= wins, then the phone's last choice, then
  // the newest tournament that has a bracket.
  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      try {
        const tournamentResponse = await clientApi.getTournaments("all");
        const list: any[] = tournamentResponse?.tournaments || [];
        let requested: string | null = null;
        let stored: string | null = null;
        try {
          requested = new URLSearchParams(window.location.search).get("t");
          stored = window.localStorage.getItem(TOURNAMENT_STORAGE_KEY);
        } catch {
          /* private mode etc. */
        }
        const chosen =
          (requested && list.find((row) => row.id === requested)) ||
          (stored && list.find((row) => row.id === stored)) ||
          list.find((row) => (row._count?.matches || 0) > 0) ||
          list[0] ||
          null;

        if (cancelled) return;
        setTournaments(list);
        if (!chosen) {
          setTournamentId(null);
          setLoading(false);
        } else {
          setTournamentId(chosen.id);
        }
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("loadFailed"));
          setLoading(false);
        }
      }
    };

    void resolve();
    return () => {
      cancelled = true;
    };
  }, [t]);

  // Load the chosen tournament's matches + notification feed (also runs when the marshal
  // switches tournament).
  useEffect(() => {
    if (!tournamentId) return;
    let cancelled = false;
    try {
      window.localStorage.setItem(TOURNAMENT_STORAGE_KEY, tournamentId);
    } catch {
      /* ignore */
    }
    setLoading(true);
    (async () => {
      try {
        const [matchData, notificationResponse] = await Promise.all([
          clientApi.getMatches(tournamentId),
          clientApi.getNotifications(tournamentId),
        ]);
        if (cancelled) return;
        applyMatches(Array.isArray(matchData) ? matchData : []);
        setNotifications(notificationResponse?.notifications || []);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : t("loadFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tournamentId, applyMatches, t]);

  const chooseTournament = useCallback(
    (id: string) => {
      setAllMatches([]);
      setCheckins({});
      setNotifications([]);
      setTournamentId(id);
      // Keep the URL shareable ("open the board for this tournament") without a navigation.
      router.replace(`/marshal/dashboard?t=${encodeURIComponent(id)}`, { scroll: false });
    },
    [router]
  );

  // Live updates: match rows and check-ins both arrive on the tournament stream. After a dropped
  // connection comes back, refetch — the stream does not replay what we missed.
  const stream = useMatchStream(
    tournamentId,
    (data) => {
      if (data?.type === "player:checkin") {
        if (!data.playerId) return;
        const playerId = data.playerId as string;
        // A local write still in flight owns the row until its response lands.
        if (savingPlayersRef.current.includes(playerId)) return;
        setCheckins((prev) => ({
          ...prev,
          [playerId]: data.checkedInAt ? String(data.checkedInAt) : null,
        }));
        setLastSyncAt(Date.now());
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
      // Frames carry full rosters (including checkedInAt after a call/complete reset).
      absorbCheckins(checkinsFromMatches([data.match]));
      setLastSyncAt(Date.now());
    },
    {
      onReconnect: () => {
        if (tournamentId) void refreshAll(tournamentId, { silent: true }).catch(() => {});
      },
    }
  );

  // Slow fallback refetch — SSE carries the live changes, this heals anything it missed.
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

  // Phones sleep and background tabs get throttled: when the board comes back into view, catch up.
  useEffect(() => {
    if (!tournamentId) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshAll(tournamentId, { silent: true }).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [tournamentId, refreshAll]);

  // "called N min ago" ticks without needing a data change.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const open = useMemo(() => allMatches.filter((m: any) => !isDone(m.status)), [allMatches]);
  const calledMatches = useMemo(() => open.filter((m) => isCalled(m.status)).sort(byCalledAt), [open]);
  const liveMatches = useMemo(() => open.filter((m) => isLive(m.status)).sort(byBracketOrder), [open]);
  const upNext = useMemo(
    () =>
      open
        .filter((m) => !isCalled(m.status) && !isLive(m.status) && m.homeTeamId && m.awayTeamId)
        .sort(byBracketOrder),
    [open]
  );
  const waitingOnResults = useMemo(
    () => open.filter((m) => !isCalled(m.status) && !isLive(m.status) && !(m.homeTeamId && m.awayTeamId)).length,
    [open]
  );

  // The local map wins when it knows the player (it is the freshest), else the row's own field.
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
          err instanceof Error ? t("checkinFailedReason", { message: err.message }) : t("checkinFailed")
        );
      } finally {
        setSavingPlayers((prev) => prev.filter((id) => id !== playerId));
      }
    },
    [checkins, t]
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
        const fresh = response?.match;
        mergeMatch(match.id, fresh ? fresh : { status: "READY", updatedAt: new Date().toISOString() });
        if (fresh) absorbCheckins(checkinsFromMatches([fresh]));
        if (tournamentId) void refreshNotifications(tournamentId).catch(() => {});
      } catch (err) {
        setActionError(
          err instanceof Error ? t("callFailedReason", { message: err.message }) : t("callFailed")
        );
      } finally {
        setBusyMatch(null);
      }
    },
    [absorbCheckins, mergeMatch, refreshNotifications, t, tournamentId]
  );

  /** "Mark live" — the teams are seated and the game has started. Scores stay in Control. */
  const markLive = useCallback(
    async (match: any) => {
      setActionError(null);
      setBusyMatch(match.id);
      try {
        const response = await clientApi.setMatchStatus(match.id, "LIVE");
        mergeMatch(match.id, { status: response?.status || response?.match?.status || "LIVE" });
      } catch (err) {
        setActionError(
          err instanceof Error ? t("liveFailedReason", { message: err.message }) : t("liveFailed")
        );
      } finally {
        setBusyMatch(null);
      }
    },
    [mergeMatch, t]
  );

  // `row`, not `t`: `t` is the translator in this scope.
  const activeTournament = tournaments.find((row) => row.id === tournamentId);
  const connection =
    stream.status === "open"
      ? { label: t("connection.live"), dot: "bg-success animate-pulse", icon: null }
      : stream.status === "reconnecting"
        ? { label: t("connection.reconnecting"), dot: "bg-warning", icon: <WifiOff size={12} /> }
        : stream.status === "connecting"
          ? { label: t("connection.connecting"), dot: "bg-fg-subtle", icon: null }
          : { label: t("connection.offline"), dot: "bg-fg-subtle", icon: <WifiOff size={12} /> };

  return (
    <div className="min-h-screen bg-page text-fg">
      <main className="mds-container space-y-6 py-6 sm:py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mds-uppercase-label text-brand">{t("eyebrow")}</p>
            <h1 className="mt-1 font-brand text-3xl font-bold tracking-tight">{t("title")}</h1>
            <p className="mt-2 max-w-2xl text-fg-muted">{t("subtitle")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {tournaments.length > 1 && (
              <label className="flex items-center gap-2 text-xs font-semibold text-fg-subtle">
                <span className="sr-only">{tc("tournament")}</span>
                <select
                  aria-label={tc("tournament")}
                  data-testid="marshal-tournament-select"
                  value={tournamentId || ""}
                  onChange={(e) => chooseTournament(e.target.value)}
                  className="mds-input h-10 max-w-[16rem] text-sm"
                >
                  {tournaments.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <span
              className="flex items-center gap-2 text-xs font-semibold text-fg-subtle"
              data-testid="marshal-connection"
              title={
                lastSyncAt
                  ? t("lastUpdate", { time: new Date(lastSyncAt).toLocaleTimeString() })
                  : undefined
              }
            >
              <span className={`h-2 w-2 rounded-full ${connection.dot}`} />
              {connection.icon}
              {connection.label}
            </span>
            <Button
              variant="ghost"
              size="sm"
              aria-label={tc("refresh")}
              disabled={!tournamentId || refreshing}
              onClick={() =>
                tournamentId &&
                void refreshAll(tournamentId).catch((err) => setError(err?.message || t("refreshFailed")))
              }
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            </Button>
          </div>
        </div>

        {error && (
          <Card className="border-danger/30">
            <p className="text-sm font-semibold text-danger">{t("loadErrorTitle")}</p>
            <p className="mt-1 text-sm text-fg-muted">{error}</p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => window.location.reload()}>
              <RefreshCw size={14} /> {t("reload")}
            </Button>
          </Card>
        )}

        {actionError && (
          <Card className="flex items-start justify-between gap-3 border-danger/30" role="alert">
            <p className="text-sm font-semibold text-danger">{actionError}</p>
            <button
              type="button"
              aria-label={tc("close")}
              className="text-fg-subtle hover:text-fg"
              onClick={() => setActionError(null)}
            >
              <X size={16} />
            </button>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="animate-spin text-brand" size={28} />
          </div>
        ) : !tournamentId ? (
          <EmptyState
            icon={<Users size={26} />}
            title={t("noTournamentTitle")}
            description={t("noTournamentBody")}
          />
        ) : (
          <>
            {activeTournament && tournaments.length === 1 && (
              <p className="text-sm text-fg-subtle">{activeTournament.name}</p>
            )}

            <Section title={t("calledSection")} count={calledMatches.length} tone="ready">
              {calledMatches.length === 0 ? (
                <p className="rounded-sm border border-dashed border-line px-4 py-3 text-sm text-fg-subtle">
                  {t("nothingCalled")}
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  {calledMatches.map((match: any) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      now={now}
                      busy={busyMatch === match.id}
                      isAtSeat={isAtSeat}
                      isSaving={isSaving}
                      onToggle={(p) => void toggleAtSeat(p)}
                      onCall={(m) => void callMatch(m)}
                      onLive={(m) => void markLive(m)}
                    />
                  ))}
                </div>
              )}
            </Section>

            {liveMatches.length > 0 && (
              <Section title={t("liveSection")} count={liveMatches.length} tone="live">
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  {liveMatches.map((match: any) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      now={now}
                      busy={busyMatch === match.id}
                      isAtSeat={isAtSeat}
                      isSaving={isSaving}
                      onToggle={(p) => void toggleAtSeat(p)}
                      onCall={(m) => void callMatch(m)}
                      onLive={(m) => void markLive(m)}
                    />
                  ))}
                </div>
              </Section>
            )}

            <Section title={t("upNextSection")} count={upNext.length} tone="neutral">
              {upNext.length === 0 && waitingOnResults === 0 ? (
                <EmptyState
                  icon={<Users size={26} />}
                  title={t("noOpenTitle")}
                  description={t("noOpenBody")}
                />
              ) : (
                <>
                  {upNext.length > 0 && (
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                      {upNext.map((match: any) => (
                        <MatchCard
                          key={match.id}
                          match={match}
                          now={now}
                          busy={busyMatch === match.id}
                          isAtSeat={isAtSeat}
                          isSaving={isSaving}
                          onToggle={(p) => void toggleAtSeat(p)}
                          onCall={(m) => void callMatch(m)}
                          onLive={(m) => void markLive(m)}
                        />
                      ))}
                    </div>
                  )}
                  {waitingOnResults > 0 && (
                    <p className="text-xs text-fg-subtle">
                      {t("waitingOnResults", { count: waitingOnResults })}
                    </p>
                  )}
                </>
              )}
            </Section>

            <section className="space-y-3 pt-2">
              <div className="flex items-center gap-2">
                <Bell size={15} className="text-brand" />
                <h2 className="mds-uppercase-label text-fg-subtle">{t("callsSection")}</h2>
              </div>
              {notifications.length === 0 ? (
                <p className="rounded-sm border border-dashed border-line px-4 py-3 text-sm text-fg-subtle">
                  {t("noCalls")}
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
                      <p className="mt-2 text-sm font-semibold">{notificationTitle(n.embed?.title, tNotif)}</p>
                      {n.embed?.description && (
                        <p className="text-xs text-fg-muted">{notificationText(n.embed.description)}</p>
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
