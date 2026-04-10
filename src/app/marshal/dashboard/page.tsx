"use client";

import React, { useState, useEffect } from "react";
import { Users, MapPin, Bell, Smartphone, Shield, Zap, RefreshCw } from "lucide-react";
import { ContextBar } from "@/components/ContextBar";
import { clientApi } from "@/lib/client-api";
import FirstRunCoach from "@/components/FirstRunCoach";

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
        const tournamentResponse = await clientApi.getTournaments('all');
        const tournaments = tournamentResponse?.tournaments || [];
        const activeTournament = tournaments.find((t: any) => (t._count?.matches || 0) > 0) || tournaments[0];

        if (activeTournament) {
          const [matchData, notificationResponse] = await Promise.all([
            clientApi.getMatches(activeTournament.id),
            clientApi.getNotifications(activeTournament.id),
          ]);

          if (!cancelled) {
            setMatches(matchData.filter((match: any) => match.status !== 'COMPLETED'));
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
          setError(err instanceof Error ? err.message : 'Failed to load marshal board');
          setLoading(false);
        }
      }
    };

    void fetchData();
    const interval = setInterval(() => {
      void fetchData();
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const toggleAtSeat = (playerId: string) => {
    setAtSeatStatus((prev) => ({
      ...prev,
      [playerId]: !prev[playerId],
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--mds-page)] flex items-center justify-center">
        <Zap className="text-[var(--mds-action)] animate-pulse" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--mds-page)]">
      <ContextBar mode="marshal" contextLabel="Marshal Board" phase="Seat Readiness" breadcrumbs={["marshal", "dashboard"]} />
      <div className="mx-auto max-w-[390px] border-x border-[var(--mds-border)] shadow-2xl relative flex min-h-[calc(100vh-2.25rem)] flex-col bg-[var(--mds-page)] text-[var(--mds-text-primary)]">
        <header className="p-6 border-b border-[var(--mds-border)] bg-[var(--mds-card)] sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded bg-[var(--mds-green)] flex items-center justify-center text-white">
                <Shield size={18} />
              </div>
              <div>
                <h1 className="text-sm font-black uppercase tracking-tighter">Marshal Board</h1>
                <p className="text-[9px] font-bold text-[var(--mds-text-subtle)] uppercase">Seat check and match readiness</p>
              </div>
            </div>
            <div className="h-2 w-2 rounded-full bg-[var(--mds-green)] animate-pulse" />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 space-y-6">
          <FirstRunCoach
            id="marshal"
            title="Floor marshal quick-start"
            steps={[
              "Confirm players are at assigned seats.",
              "Watch WAITING FOR PLAYERS cards and clear blockers fast.",
              "Use the notification log for real-time match calls.",
            ]}
          />

          {error ? (
            <div className="mds-card p-5 border-[var(--mds-red)]/30">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--mds-red)]">Could not refresh board</p>
              <p className="mt-2 text-sm text-[var(--mds-text-muted)]">{error}</p>
              <button type="button" onClick={() => window.location.reload()} className="mt-4 mds-btn-secondary h-10 px-4 text-[10px] font-black uppercase tracking-widest">
                <RefreshCw size={14} />
                Reload
              </button>
            </div>
          ) : null}

          <div className="flex items-center justify-between px-2">
            <h2 className="mds-uppercase-label text-[10px]">Open Matches</h2>
            <span className="text-[9px] font-black text-[var(--mds-action)] bg-[var(--mds-action-soft)] px-2 py-0.5 rounded uppercase">{matches.length} Matches</span>
          </div>

          {matches.length === 0 ? (
            <div className="py-20 text-center mds-card border-dashed">
              <Users className="mx-auto text-[var(--mds-text-subtle)] opacity-30 mb-4" size={32} />
              <p className="text-[10px] font-black text-[var(--mds-text-subtle)] uppercase tracking-widest">No open match cards</p>
            </div>
          ) : (
            <div className="space-y-4">
              {matches.map((match: any) => (
                <div key={match.id} data-testid={`marshal-match-${match.id}`} className="mds-card p-0 overflow-hidden border-[var(--mds-border)] hover:border-[var(--mds-action)]/40 transition-all shadow-lg">
                  <div className="px-4 py-2 bg-[var(--mds-input)]/40 border-b border-[var(--mds-border)] flex items-center justify-between">
                    <span className="text-[9px] font-black text-[var(--mds-text-subtle)] uppercase tracking-wider">MATCH #{match.id.slice(0, 4)}</span>
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${match.status === 'LIVE' ? 'bg-[var(--mds-red)] text-white' : match.status === 'WAITING_FOR_PLAYERS' ? 'bg-[var(--mds-amber)] text-black' : 'bg-[var(--mds-input)] text-[var(--mds-text-muted)]'}`}>
                      {String(match.status || 'READY').replaceAll('_', ' ')}
                    </span>
                  </div>

                  <div className="p-4 space-y-4">
                    {[match.homeTeam, match.awayTeam].map((team: any, teamIndex: number) => (
                      <div key={team?.id || teamIndex} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className={`text-[11px] font-black uppercase ${teamIndex === 0 ? 'text-[var(--mds-action)]' : 'text-[var(--mds-text-primary)]'}`}>{team?.name || (teamIndex === 0 ? 'TEAM A' : 'TEAM B')}</span>
                          <span className="text-[9px] font-bold text-[var(--mds-text-subtle)] italic">Seed #{team?.seed || teamIndex + 1}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {team?.players?.map((player: any) => (
                            <button
                              key={player.id}
                              onClick={() => toggleAtSeat(player.id)}
                              className={`p-3 rounded border text-left flex flex-col gap-1 transition-all ${
                                atSeatStatus[player.id]
                                  ? 'bg-[var(--mds-green)]/10 border-[var(--mds-green)]/40 ring-1 ring-[var(--mds-green)]/20'
                                  : 'bg-[var(--mds-input)] border-[var(--mds-border)]'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase truncate max-w-[60px]">{player.nickname || player.name.split(' ')[0]}</span>
                                <MapPin size={10} className={atSeatStatus[player.id] ? 'text-[var(--mds-green)]' : 'text-[var(--mds-text-subtle)]'} />
                              </div>
                              <span className="text-[9px] font-bold font-mono text-[var(--mds-action)]">{player.seating || 'TBD'}</span>
                            </button>
                          ))}
                        </div>
                        {teamIndex === 0 ? <div className="h-px w-full bg-gradient-to-r from-transparent via-[var(--mds-border)] to-transparent opacity-50" /> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <section className="space-y-4 pt-6">
            <div className="flex items-center gap-2 px-2">
              <Bell size={14} className="text-[var(--mds-action)]" />
              <h2 className="mds-uppercase-label text-[10px]">Notification Log</h2>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {notifications.length === 0 ? (
                <div className="p-4 bg-[var(--mds-input)]/20 border border-dashed border-[var(--mds-border)] rounded text-center">
                  <p className="text-[9px] font-bold text-[var(--mds-text-subtle)] uppercase">No alerts yet</p>
                </div>
              ) : (
                notifications.map((notification: any) => (
                  <div key={notification.id} data-testid="notification-entry" className="p-4 bg-[var(--mds-input)] border border-[var(--mds-border)] rounded-md space-y-2 animate-in slide-in-from-bottom-2">
                    <div className="flex items-center justify-between">
                      <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                        notification.type === 'MATCH' ? 'bg-[var(--mds-red)] text-white' :
                        notification.type === 'RESULT' ? 'bg-[var(--mds-green)] text-white' :
                        'bg-[var(--mds-action)] text-white'
                      }`}>
                        {notification.type}
                      </span>
                      <span className="text-[8px] font-bold text-[var(--mds-text-subtle)]">{new Date(notification.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-[10px] font-bold uppercase leading-tight line-clamp-1">{notification.embed?.title}</p>
                    <p className="text-[9px] text-[var(--mds-text-subtle)] leading-relaxed">{notification.embed?.description}</p>
                  </div>
                ))
              )}
            </div>
          </section>
        </main>

        <nav className="h-20 bg-[var(--mds-card)] border-t border-[var(--mds-border)] flex items-center justify-around px-8 sticky bottom-0">
          <div className="flex flex-col items-center gap-1 text-[var(--mds-green)] scale-110">
            <Smartphone size={20} />
            <span className="text-[8px] font-black uppercase">Floor</span>
          </div>
          <div className="flex flex-col items-center gap-1 text-[var(--mds-text-muted)] opacity-70">
            <Zap size={20} />
            <span className="text-[8px] font-black uppercase">Alerts</span>
          </div>
        </nav>
      </div>
    </div>
  );
}
