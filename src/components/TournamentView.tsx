"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Trophy, Users, Play, X, Gamepad2, MoreHorizontal, Command } from "lucide-react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMatchStream } from "@/hooks/useMatchStream";
import PublicBracket from "@/components/PublicBracket";
import { getGameMetadata } from "@/lib/games";
import { ContextBar } from "@/components/ContextBar";
import { useToast } from "@/components/ToastProvider";

// Modular Components
import { TournamentHero } from "./tournament/TournamentHero";
import { TournamentTabs } from "./tournament/TournamentTabs";
import { TournamentOverview } from "./tournament/TournamentOverview";
import { MatchList } from "./tournament/MatchList";
import { TeamRegistry } from "./tournament/TeamRegistry";
import { StatsTable } from "./tournament/StatsTable";
import { getTournamentTabItems } from "./tournament/tournament-tabs-config";
import { openCommandPalette } from "./CommandPalette";
import { usePerformanceBudget } from "@/hooks/usePerformanceBudget";

interface TournamentViewProps {
  id: string;
}

function useModalA11y(
  modalRef: React.RefObject<HTMLDivElement>,
  open: boolean,
  onClose: () => void,
  lastFocusedRef: React.MutableRefObject<HTMLElement | null>
) {
  useEffect(() => {
    if (!open) {
      return;
    }

    lastFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = modalRef.current;
    if (!root) {
      return;
    }

    const focusables = root.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    first?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === "Tab" && focusables.length > 0) {
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      lastFocusedRef.current?.focus();
    };
  }, [lastFocusedRef, modalRef, onClose, open]);
}

export default function TournamentView({ id }: TournamentViewProps) {
  usePerformanceBudget("TournamentView", 240);
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [showMobileTabSheet, setShowMobileTabSheet] = useState(false);
  const teamModalRef = useRef<HTMLDivElement>(null);
  const playerModalRef = useRef<HTMLDivElement>(null);
  const matchModalRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  const getFlagUrl = (countryCode: string | null) => {
    if (!countryCode) return null;
    const mapping: { [key: string]: number } = {
      'no': 129, 'se': 151, 'dk': 84, 'fi': 90, 'is': 103,
      'de': 163, 'gb': 150, 'us': 166, 'ca': 109, 'au': 15
    };
    const code = countryCode.toLowerCase();
    const flagId = mapping[code];
    return flagId ? `https://dynamic.fragbite.se/flags/4x3/${flagId}.svg` : null;
  };

  const { data: tournament } = useQuery({
    queryKey: ['tournament', id],
    queryFn: async () => {
      const res = await fetch(`/api/tournaments/${id}`);
      if (res.status === 404) {
        return null;
      }
      if (!res.ok) {
        throw new Error('Failed to fetch tournament');
      }
      return res.json();
    },
    staleTime: Infinity
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams', id],
    queryFn: async () => {
      const res = await fetch(`/api/tournaments/${id}/teams`);
      return res.json();
    }
  });

  const { data: matches = [] } = useQuery({
    queryKey: ['matches', id],
    queryFn: async () => {
      const res = await fetch(`/api/tournaments/${id}/matches`);
      return res.json();
    }
  });

  const { data: scoreboard = [] } = useQuery({
    queryKey: ['scoreboard', id],
    queryFn: async () => {
      const res = await fetch(`/api/tournaments/${id}/scoreboard`);
      return res.json();
    }
  });

  useMatchStream(id, (data) => {
    queryClient.setQueryData(['matches', id], (prev: any[] | undefined) => 
      prev?.map((m) => (m.id === data.matchId ? { ...m, ...data.match } : m))
    );
  });

  const liveMatches = matches.filter((m: any) => m.status === 'LIVE' || m.status === 'IN_PROGRESS');
  const gameMeta = getGameMetadata(tournament?.game || "CS2");
  const tabItems = getTournamentTabItems(tournament?.category || "BRACKET");
  const primaryMobileTabs = tabItems.slice(0, 4);
  const overflowMobileTabs = tabItems.slice(4);
  const validTabs = useMemo(() => new Set(tabItems.map((tab) => tab.id)), [tabItems]);

  useEffect(() => {
    if (!tournament) {
      return;
    }
    const tabFromUrl = searchParams.get("tab");
    if (tabFromUrl && validTabs.has(tabFromUrl) && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [activeTab, searchParams, validTabs, tournament]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  useModalA11y(teamModalRef, Boolean(selectedTeam), () => setSelectedTeam(null), lastFocusedRef);
  useModalA11y(playerModalRef, Boolean(selectedPlayer), () => setSelectedPlayer(null), lastFocusedRef);
  useModalA11y(matchModalRef, Boolean(selectedMatch), () => setSelectedMatch(null), lastFocusedRef);

  if (!tournament) {
    return (
      <div className="min-h-screen bg-[var(--mds-page)] p-8 text-[var(--mds-text-primary)]">
        <div className="mx-auto mt-20 max-w-xl rounded-xl border border-[var(--mds-border)] bg-[var(--mds-card)] p-8 text-center">
          <h1 className="text-2xl font-black uppercase tracking-tight">Tournament Not Found</h1>
          <p className="mt-3 text-sm text-[var(--mds-text-muted)]">
            This tournament could not be loaded. It may have been removed.
          </p>
          <Link href="/tournaments" className="mds-btn-primary mt-6 h-11 px-8 text-xs font-black uppercase tracking-widest">
            Back to Tournaments
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[var(--mds-page)] font-sans antialiased text-[var(--mds-text-primary)]">
      <ContextBar
        mode="public"
        contextLabel={tournament.name}
        phase={activeTab.toUpperCase()}
        breadcrumbs={["tournaments", tournament.name, activeTab]}
      />
      
      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR (DESKTOP) */}
        <aside className="hidden w-72 flex-col border-r border-[var(--mds-border)] bg-[var(--mds-card)] lg:flex shrink-0">
          <TournamentTabs 
            activeTab={activeTab} 
            setActiveTab={handleTabChange} 
            tournamentCategory={tournament.category} 
          />

          <div className="mt-auto p-8 border-t border-[var(--mds-border)] bg-[var(--mds-input)]/20">
                <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-[var(--mds-green)] shadow-[0_0_8px_var(--mds-green)]" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-[var(--mds-text-subtle)]">Live tournament page</span>
                 </div>
          </div>
        </aside>

        {/* MAIN VIEWPORT */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <TournamentHero 
            tournament={tournament}
            teamsCount={teams.length}
            matchesCount={matches.length}
            liveMatchesCount={liveMatches.length}
            gameMeta={gameMeta}
            onShare={() => {
                navigator.clipboard.writeText(window.location.href);
                toast.success("Link copied", "The tournament page link is on your clipboard.");
            }}
          />

          {/* SCROLLABLE VIEW AREA */}
          <div className="custom-scrollbar flex-1 overflow-y-auto p-6 pb-28 lg:p-12 lg:pb-12">
            <div className="mx-auto max-w-[var(--mds-max-content)]">
              
              {activeTab === "overview" && (
                <TournamentOverview 
                  tournament={tournament}
                  teams={teams}
                  matches={matches}
                  liveMatches={liveMatches}
                  onViewTeam={setSelectedTeam}
                  onSetTab={handleTabChange}
                />
              )}

              {activeTab === "bracket" && tournament.category !== 'BATTLE_ROYALE' && (
                <div className="mds-card h-[700px] overflow-hidden p-0 animate-in fade-in duration-500 shadow-2xl relative">
                  <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none" />
                  <PublicBracket 
                    tournamentId={id} 
                    matches={matches} 
                    onMatchClick={(matchId: string) => setSelectedMatch(matches.find((m: any) => m.id === matchId))}
                  />
                </div>
              )}

              {activeTab === "leaderboard" && (
                <div className="space-y-4">
                  <h2 className="text-xl font-black uppercase tracking-tight">Leaderboard</h2>
                  {scoreboard.length === 0 ? (
                    <div className="mds-card border-dashed text-center">
                      <p className="text-sm text-[var(--mds-text-muted)]">No leaderboard data yet.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-[var(--mds-border)]">
                      <table className="mds-table min-w-full">
                        <thead>
                          <tr>
                            <th>Team</th>
                            <th>Points</th>
                            <th>Kills</th>
                            <th>Placement</th>
                          </tr>
                        </thead>
                        <tbody>
                          {scoreboard.map((entry: any, index: number) => (
                            <tr key={entry.id || `${entry.teamId}-${index}`}>
                              <td>{entry.team?.name || "Unknown Team"}</td>
                              <td>{entry.points ?? 0}</td>
                              <td>{entry.kills ?? 0}</td>
                              <td>{entry.placement ?? "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "teams" && (
                <TeamRegistry 
                  teams={teams} 
                  onViewTeam={setSelectedTeam} 
                />
              )}

              {activeTab === "players" && (
                <StatsTable 
                  players={teams.flatMap((t: any) => t.players?.map((p: any) => ({ ...p, teamName: t.name })) || [])} 
                  onViewPlayer={setSelectedPlayer}
                  getFlagUrl={getFlagUrl}
                />
              )}

              {activeTab === "matches" && (
                <MatchList 
                  matches={matches} 
                  tournamentId={id} 
                />
              )}

            </div>
          </div>
        </main>

        {/* RIGHT SIDEBAR (SUMMARY PANEL) */}
        <aside className="hidden lg:flex w-80 flex-col border-l border-[var(--mds-border)] bg-[var(--mds-card)] h-full overflow-hidden shrink-0 shadow-lg">
           <div className="flex flex-col h-full p-8 space-y-12 overflow-y-auto custom-scrollbar">
              
              {/* TOURNAMENT PROGRESS */}
              <section className="space-y-6">
                 <div className="flex items-center justify-between">
                    <h3 className="mds-uppercase-label text-[10px] tracking-[0.2em]">Tournament Progress</h3>
                    <span className="font-black text-xs text-[var(--mds-action)]">
                       {(() => {
                          const total = matches.length;
                          const completed = matches.filter((m: any) => m.status === 'COMPLETED').length;
                          return total > 0 ? Math.round((completed / total) * 100) : 0;
                       })()}%
                    </span>
                 </div>
                 <div className="relative h-1 w-full bg-[var(--mds-input)] rounded-full overflow-hidden shadow-inner">
                    <div 
                      className="absolute inset-y-0 left-0 bg-[var(--mds-action)] transition-all duration-1000 ease-out shadow-[0_0_8px_var(--mds-action)]" 
                      style={{ width: `${(() => {
                          const total = matches.length;
                          const completed = matches.filter((m: any) => m.status === 'COMPLETED').length;
                          return total > 0 ? (completed / total) * 100 : 0;
                       })()}%` }}
                    />
                 </div>
              </section>

              {/* LIVE RECAP */}
              <section className="space-y-6">
                 <div className="flex items-center gap-3">
                    <div className="h-1.5 w-1.5 rounded-full bg-[var(--mds-red)] animate-pulse shadow-[0_0_8px_var(--mds-red)]" />
                    <h3 className="mds-uppercase-label text-[10px] tracking-[0.2em] text-[var(--mds-red)]">Live Broadcast</h3>
                 </div>
                 
                 <div className="space-y-4">
                    {liveMatches.length > 0 ? (
                      liveMatches.map((match: any) => (
                        <div key={match.id} className="mds-card p-5 group hover:border-[var(--mds-red)]/40 transition-all bg-[var(--mds-input)]/40 border-[var(--mds-border)]">
                           <div className="flex items-center justify-between mb-4">
                              <span className="text-[9px] font-black text-[var(--mds-text-subtle)] uppercase tracking-wider">{`R${match.round} | ${match.id.slice(0,4)}`}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black text-[var(--mds-red)] tracking-widest uppercase">LIVE</span>
                              </div>
                           </div>
                           <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                 <span className="text-xs font-black text-[var(--mds-text-primary)] uppercase truncate max-w-[120px]">{match.homeTeam?.name || "TBD"}</span>
                                 <span className="text-lg font-black text-[var(--mds-action)] tabular-nums">{match.homeScore}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                 <span className="text-xs font-black text-[var(--mds-text-subtle)] uppercase truncate max-w-[120px]">{match.awayTeam?.name || "TBD"}</span>
                                 <span className="text-lg font-black text-[var(--mds-text-subtle)] tabular-nums">{match.awayScore}</span>
                              </div>
                           </div>
                           <Link 
                             href={`/bracket/${id}/overlay`}
                             target="_blank"
                             className="mt-5 mds-btn-primary h-9 w-full text-[10px] font-black uppercase tracking-widest gap-2 bg-[var(--mds-red)] hover:bg-[var(--mds-red)]/80 shadow-lg shadow-[var(--mds-red)/20]"
                           >
                             <Play size={12} fill="currentColor" /> Watch Stream
                           </Link>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 border border-dashed border-[var(--mds-border)] rounded-lg text-center opacity-30">
                         <p className="text-[9px] font-black uppercase tracking-widest text-[var(--mds-text-subtle)]">No Active Matches</p>
                      </div>
                    )}
                 </div>
              </section>

              {/* NEXT MATCHES */}
              <section className="space-y-6">
                 <h3 className="mds-uppercase-label text-[10px] tracking-[0.2em]">Upcoming Queue</h3>
                 <div className="space-y-3">
                    {matches
                      .filter((m: any) => m.status === 'PENDING' || m.status === 'READY')
                      .slice(0, 5)
                      .map((match: any) => (
                      <div key={match.id} className="p-4 rounded-md bg-[var(--mds-input)] border border-[var(--mds-border)] hover:border-[var(--mds-action)]/40 transition-all">
                         <div className="flex items-center justify-between gap-4 text-[10px] font-black uppercase tracking-tight">
                            <span className="text-[var(--mds-text-primary)] truncate flex-1">{match.homeTeam?.name || "TBD"}</span>
                            <span className="text-[var(--mds-text-subtle)] opacity-40">VS</span>
                            <span className="text-[var(--mds-text-primary)] truncate flex-1 text-right">{match.awayTeam?.name || "TBD"}</span>
                         </div>
                      </div>
                    ))}
                 </div>
              </section>
           </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-[120] border-t border-[var(--mds-border)] bg-[var(--mds-card)] px-2 py-2 lg:hidden">
        <div className="grid grid-cols-5 gap-2">
          {primaryMobileTabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                data-testid={`tournament-mobile-tab-${tab.id}`}
                className={`flex h-12 flex-col items-center justify-center rounded-lg text-[9px] font-bold uppercase tracking-wider ${active ? "bg-[var(--mds-action-soft)] text-[var(--mds-action)]" : "text-[var(--mds-text-muted)]"}`}
              >
                <Icon size={16} />
                <span className="mt-1">{tab.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setShowMobileTabSheet(true)}
            data-testid="tournament-mobile-tab-more"
            className="flex h-12 flex-col items-center justify-center rounded-lg text-[9px] font-bold uppercase tracking-wider text-[var(--mds-text-muted)]"
          >
            <MoreHorizontal size={16} />
            <span className="mt-1">More</span>
          </button>
        </div>
      </div>

      {showMobileTabSheet ? (
        <div className="fixed inset-0 z-[220] bg-black/50 p-4 backdrop-blur-sm lg:hidden" onClick={() => setShowMobileTabSheet(false)}>
          <div data-testid="tournament-mobile-more-sheet" className="mx-auto mt-[20vh] w-full max-w-md rounded-xl border border-[var(--mds-border)] bg-[var(--mds-card)] p-3" onClick={(event) => event.stopPropagation()}>
            <p className="px-3 pb-2 pt-1 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--mds-text-subtle)]">Tournament Actions</p>
            <div className="space-y-1">
              {overflowMobileTabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      handleTabChange(tab.id);
                      setShowMobileTabSheet(false);
                    }}
                    data-testid={`tournament-mobile-tab-overflow-${tab.id}`}
                    className={`mds-nav-link w-full text-left ${active ? "active" : ""}`}
                  >
                    <Icon size={16} className={active ? "text-[var(--mds-action)]" : "text-[var(--mds-text-subtle)]"} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setShowMobileTabSheet(false);
                  openCommandPalette();
                }}
                data-testid="tournament-open-command-palette"
                className="mds-nav-link w-full text-left"
              >
                <Command size={16} className="text-[var(--mds-text-subtle)]" />
                <span>Command Palette</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* MODALS */}
      {selectedTeam && (
        <TeamDetailsModal 
            team={selectedTeam} 
            onClose={() => setSelectedTeam(null)} 
            matches={matches} 
            getFlagUrl={getFlagUrl}
            modalRef={teamModalRef}
        />
      )}

      {selectedPlayer && (
        <PlayerDetailsModal 
            player={selectedPlayer} 
            onClose={() => setSelectedPlayer(null)} 
            getFlagUrl={getFlagUrl}
            modalRef={playerModalRef}
        />
      )}

      {selectedMatch && (
        <MatchAnalysisModal 
            match={selectedMatch}
            onClose={() => setSelectedMatch(null)}
            modalRef={matchModalRef}
        />
      )}
    </div>
  );
}

// Sub-modals for details
function TeamDetailsModal({ team, onClose, matches, getFlagUrl, modalRef }: any) {
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 lg:p-12 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-[var(--mds-overlay)] backdrop-blur-sm" onClick={onClose} />
          <div ref={modalRef} role="dialog" aria-modal="true" aria-label="Team details" className="mds-card w-full max-w-5xl max-h-[85vh] relative z-10 flex flex-col p-0 overflow-hidden shadow-2xl scale-in-center">
            <header className="p-8 lg:p-12 border-b border-[var(--mds-border)] flex flex-col md:flex-row items-center justify-between gap-8 bg-[var(--mds-input)]/20">
              <div className="flex items-center gap-8">
                <div className="h-24 w-24 rounded-lg border border-[var(--mds-border)] bg-[var(--mds-page)] p-4 shadow-lg">
                  {team.logoUrl ? (
                    <Image src={team.logoUrl} alt="" width={96} height={96} className="h-full w-full object-contain grayscale" />
                  ) : (
                    <Users size={40} className="text-[var(--mds-text-subtle)]" />
                  )}
                </div>
                <div>
                  <h2 className="text-4xl font-black tracking-tight text-[var(--mds-text-primary)] leading-tight uppercase">{team.name}</h2>
                  <div className="mt-2 flex items-center gap-6">
                    <span className="mds-badge bg-[var(--mds-action-soft)] text-[var(--mds-action)] font-black">{team.players?.length || 0} PLAYERS</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-[var(--mds-text-subtle)]">ID: {team.id.slice(0, 8)}</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="mds-btn-secondary h-12 w-12 p-0 flex items-center justify-center"
              >
                <X size={20} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-10 lg:p-12 custom-scrollbar grid grid-cols-1 lg:grid-cols-2 gap-12">
               <section className="space-y-6">
                 <h3 className="mds-uppercase-label border-b border-[var(--mds-border)] pb-4 text-[12px] font-black uppercase tracking-widest">Team Roster</h3>
                 <div className="grid grid-cols-1 gap-4">
                   {team.players?.map((p: any, idx: number) => (
                     <div key={idx} className="p-4 rounded-md bg-[var(--mds-input)] border border-[var(--mds-border)] flex items-center justify-between group transition-all hover:border-[var(--mds-action)]/40">
                        <div className="flex items-center gap-4">
                            <span className="text-[10px] font-black text-[var(--mds-text-subtle)]">{(idx + 1).toString().padStart(2, '0')}</span>
                            <div className="flex items-center gap-2">
                                {getFlagUrl(p.countryCode) && (
                                    <Image
                                      src={getFlagUrl(p.countryCode)!}
                                      alt=""
                                      width={16}
                                      height={12}
                                      className="h-3 w-4 object-cover rounded-[1px]"
                                      unoptimized
                                    />
                                )}
                                <span className="font-bold text-[14px] uppercase tracking-tight">{p.nickname || p.name.split(' ')[0]}</span>
                            </div>
                        </div>
                     </div>
                   ))}
                 </div>
               </section>

               <section className="space-y-6">
                 <h3 className="mds-uppercase-label border-b border-[var(--mds-border)] pb-4 text-[12px] font-black uppercase tracking-widest">Match History</h3>
                 <div className="space-y-4">
                   {matches.filter((m: any) => m.homeTeamId === team.id || m.awayTeamId === team.id)
                     .sort((a: any, b: any) => b.round - a.round)
                     .slice(0, 5)
                     .map((m: any) => {
                       const isHome = m.homeTeamId === team.id;
                       const opponent = isHome ? m.awayTeam?.name : m.homeTeam?.name;
                       const won = (isHome && m.homeScore > m.awayScore) || (!isHome && m.awayScore > m.homeScore);
                       
                       return (
                         <div key={m.id} className="p-4 rounded-md bg-[var(--mds-card)] border border-[var(--mds-border)] flex items-center justify-between group transition-all hover:border-[var(--mds-action)]/40">
                           <div className="space-y-1">
                              <span className="text-[9px] font-black text-[var(--mds-text-subtle)] uppercase">Round {m.round}</span>
                              <p className="font-bold text-[13px] uppercase tracking-tight">vs {opponent || 'PENDING'}</p>
                           </div>
                           <div className="text-right">
                              <span className="block font-black text-lg tracking-tighter tabular-nums">{m.homeScore} : {m.awayScore}</span>
                              <span className={`text-[9px] font-black uppercase tracking-widest ${won ? 'text-[var(--mds-green)]' : 'text-[var(--mds-red)]'}`}>
                                 {won ? 'WIN' : 'LOSS'}
                              </span>
                           </div>
                         </div>
                       );
                     })}
                 </div>
               </section>
            </div>
            
            <footer className="p-8 bg-[var(--mds-input)]/20 border-t border-[var(--mds-border)] flex justify-end">
               <button onClick={onClose} className="mds-btn-primary h-12 px-10 font-black uppercase tracking-widest text-[11px]">Close Details</button>
            </footer>
          </div>
        </div>
    );
}

function PlayerDetailsModal({ player, onClose, getFlagUrl, modalRef }: any) {
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 lg:p-12 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-[var(--mds-overlay)] backdrop-blur-sm" onClick={onClose} />
          <div ref={modalRef} role="dialog" aria-modal="true" aria-label="Player details" className="mds-card w-full max-w-2xl relative z-10 flex flex-col p-0 overflow-hidden shadow-2xl scale-in-center">
            <header className="p-12 border-b border-[var(--mds-border)] bg-[var(--mds-input)]/20">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-8">
                      <div className="h-20 w-20 rounded-lg bg-[var(--mds-action-soft)] flex items-center justify-center text-[var(--mds-action)] border border-[var(--mds-action)]/20">
                         <Users size={32} />
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                           {getFlagUrl(player.countryCode) && (
                             <Image
                               src={getFlagUrl(player.countryCode)!}
                               alt=""
                               width={24}
                               height={16}
                               className="h-4 w-6 rounded-[1px] shadow-sm"
                               unoptimized
                             />
                           )}
                           <h2 className="text-4xl font-black tracking-tight uppercase leading-none">{player.nickname || player.name.split(' ')[0]}</h2>
                        </div>
                        <p className="mt-2 text-[10px] font-black text-[var(--mds-text-subtle)] uppercase tracking-[0.2em]">
                           {player.teamName}
                        </p>
                      </div>
                  </div>
                  <button onClick={onClose} className="mds-btn-secondary h-12 w-12 p-0 flex items-center justify-center">
                    <X size={20} />
                  </button>
               </div>
            </header>

            <div className="p-12 space-y-12">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-8 rounded-md bg-[var(--mds-input)]/50 text-center border border-[var(--mds-border)]">
                     <span className="mds-uppercase-label text-[9px] mb-4 opacity-40">Display Name</span>
                     <span className="block text-2xl font-black text-[var(--mds-action)]">{player.nickname || player.name}</span>
                  </div>
                  <div className="p-8 rounded-md bg-[var(--mds-input)]/50 text-center border border-[var(--mds-border)]">
                     <span className="mds-uppercase-label text-[11px] mb-4 opacity-40">Country</span>
                     <span className="block text-2xl font-black text-[var(--mds-text-primary)]">{player.countryCode?.toUpperCase() || 'N/A'}</span>
                  </div>
                  <div className="p-8 rounded-md bg-[var(--mds-input)]/50 text-center border border-[var(--mds-border)]">
                     <span className="mds-uppercase-label text-[11px] mb-4 opacity-40">Seat</span>
                     <span className="block text-2xl font-black text-[var(--mds-green)]">{player.seating || 'Not assigned'}</span>
                  </div>
               </div>

               <div className="space-y-4">
                  <h3 className="mds-uppercase-label text-[11px] font-black opacity-30 tracking-[0.2em]">Player Details</h3>
                  <p className="text-[var(--mds-text-muted)] text-[13px] leading-relaxed font-medium">
                     ApexPlay currently tracks basic roster details here so staff and viewers can confirm who is on each team.
                  </p>
               </div>
            </div>

            <footer className="p-10 border-t border-[var(--mds-border)] flex justify-end bg-[var(--mds-input)]/20">
               <button onClick={onClose} className="mds-btn-primary h-12 px-10 font-black uppercase tracking-widest text-[11px]">Return to Hub</button>
            </footer>
          </div>
        </div>
    );
}

function MatchAnalysisModal({ match, onClose, modalRef }: any) {
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 lg:p-12 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-[var(--mds-overlay)] backdrop-blur-md" onClick={onClose} />
          <div ref={modalRef} role="dialog" aria-modal="true" aria-label="Match analysis" className="mds-card w-full max-w-4xl relative z-10 flex flex-col p-0 overflow-hidden shadow-2xl scale-in-center">
             <header className="p-8 lg:p-12 border-b border-[var(--mds-border)] flex items-center justify-between bg-[var(--mds-input)]/20">
                <div className="flex items-center gap-6">
                    <div className="h-10 w-10 flex items-center justify-center rounded bg-[var(--mds-action-soft)] text-[var(--mds-action)] border border-[var(--mds-action)]/20">
                        <Gamepad2 size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black uppercase tracking-tight m-0">Match Statistics</h2>
                        <p className="text-[10px] mds-uppercase-label opacity-40 mt-1">{`Round ${match.round} | Match details`}</p>
                    </div>
                </div>
                <button onClick={onClose} className="mds-btn-secondary h-10 w-10 p-0 flex items-center justify-center">
                    <X size={18} />
                </button>
             </header>

             <div className="flex-1 p-12 overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between gap-8 mb-12">
                   <div className="flex flex-col items-center gap-4 flex-1">
                      <div className="h-20 w-20 rounded-lg border border-[var(--mds-border)] bg-[var(--mds-page)] p-4 flex items-center justify-center">
                        {match.homeTeam?.logoUrl ? <Image src={match.homeTeam.logoUrl} width={80} height={80} alt="" className="grayscale" /> : <Trophy size={40} className="text-[var(--mds-text-subtle)]" />}
                      </div>
                      <span className="text-xl font-black uppercase tracking-tight text-center">{match.homeTeam?.name || "TBD"}</span>
                   </div>

                   <div className="flex flex-col items-center gap-2 px-12 py-6 bg-[var(--mds-input)] border border-[var(--mds-border)] rounded-2xl">
                      <div className="flex items-center gap-8">
                        <span className="text-6xl font-black tabular-nums">{match.homeScore}</span>
                        <span className="text-4xl font-black text-[var(--mds-text-subtle)]">:</span>
                        <span className="text-6xl font-black tabular-nums text-[var(--mds-text-subtle)]">{match.awayScore}</span>
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-widest ${match.status === 'LIVE' ? 'text-[var(--mds-red)] animate-pulse' : 'text-[var(--mds-text-subtle)]'}`}>
                        {match.status}
                      </span>
                   </div>

                   <div className="flex flex-col items-center gap-4 flex-1">
                      <div className="h-20 w-20 rounded-lg border border-[var(--mds-border)] bg-[var(--mds-page)] p-4 flex items-center justify-center">
                        {match.awayTeam?.logoUrl ? <Image src={match.awayTeam.logoUrl} width={80} height={80} alt="" className="grayscale" /> : <Trophy size={40} className="text-[var(--mds-text-subtle)]" />}
                      </div>
                      <span className="text-xl font-black uppercase tracking-tight text-center">{match.awayTeam?.name || "TBD"}</span>
                   </div>
                </div>

                <div className="bg-[var(--mds-input)]/20 rounded-xl border border-[var(--mds-border)] p-8">
                    <p className="text-center text-[var(--mds-text-subtle)] text-xs font-medium italic">Detailed round-by-round stats are not available yet for this match.</p>
                </div>
             </div>

             <footer className="p-8 border-t border-[var(--mds-border)] bg-[var(--mds-input)]/20 flex justify-end">
                <button onClick={onClose} className="mds-btn-primary h-12 px-10 font-black uppercase tracking-widest text-[11px]">Close Analysis</button>
             </footer>
          </div>
        </div>
    )
}
