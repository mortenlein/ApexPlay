"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import { Trophy, Users, Calendar, Layout, Info, ArrowRight, Loader2, Gamepad2, Play, Search, Bell, Settings, LogOut, Home, Menu, X } from "lucide-react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMatchStream } from "@/hooks/useMatchStream";
import PublicBracket from "@/components/PublicBracket";
import LiveMatchCard from "@/components/LiveMatchCard";
import { getGameMetadata } from "@/lib/games";

interface TournamentViewProps {
    id: string;
}

export default function TournamentView({ id }: TournamentViewProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [teamSearch, setTeamSearch] = useState("");

  const { data: tournament } = useQuery({
    queryKey: ['tournament', id],
    queryFn: async () => {
      const res = await fetch(`/api/tournaments`);
      const all = await res.json();
      return all.find((t: any) => t.id === id);
    },
    staleTime: Infinity // Assume it was prefetched
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

  // Real-time updates
  useMatchStream(id, (data) => {
    queryClient.setQueryData(['matches', id], (prev: any[] | undefined) => 
      prev?.map((m) => (m.id === data.matchId ? { ...m, ...data.match } : m))
    );
  });

  if (!tournament) return null;

  const liveMatches = matches.filter((m: any) => m.status === 'LIVE' || m.status === 'IN_PROGRESS');
  const gameMeta = getGameMetadata(tournament.game);

  return (
    <div className="flex h-screen bg-[#0d0f12] text-white overflow-hidden font-sans selection:bg-blue-500/30 relative">
      {/* MOBILE OVERLAY */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setIsMenuOpen(false)}>
          <div className="w-64 h-full bg-[#16191d] p-8 flex flex-col gap-8 shadow-2xl animate-in slide-in-from-left duration-300" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <Trophy size={32} className="text-blue-500" />
              <button onClick={() => setIsMenuOpen(false)} className="p-2 hover:bg-white/5 rounded-xl transition-all">
                <X size={24} />
              </button>
            </div>
            <nav className="flex flex-col gap-4">
              {[
                { id: "overview", icon: Home, label: "Home" },
                { 
                    id: tournament.category === 'BATTLE_ROYALE' ? "leaderboard" : "bracket", 
                    icon: Layout, 
                    label: tournament.category === 'BATTLE_ROYALE' ? "Leaderboard" : "Bracket" 
                },
                { id: "teams", icon: Users, label: "Teams" },
                { id: "mvp", icon: Trophy, label: "MVP" },
                { id: "schedule", icon: Calendar, label: "Schedule" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setIsMenuOpen(false); }}
                  className={`flex items-center gap-4 p-4 rounded-2xl transition-all font-bold uppercase tracking-widest text-[10px] ${
                    activeTab === tab.id ? "bg-blue-600 text-white" : "hover:bg-white/5 text-gray-400"
                  }`}
                >
                  <tab.icon size={20} />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* LEFT SIDEBAR (SLIM - DESKTOP ONLY) */}
      <aside className="hidden md:flex w-20 bg-[#16191d] border-r border-white/5 flex-col items-center py-8 gap-10 shrink-0">
        <Link href="/tournaments" className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20 active:scale-95 transition-all">
          <Trophy size={24} className="text-white" />
        </Link>
        
        <nav className="flex flex-col gap-6 font-mono font-bold uppercase text-[10px] tracking-widest text-[#5e636e]">
          {[
            { id: "overview", icon: Home, label: "Home" },
            { 
                id: tournament.category === 'BATTLE_ROYALE' ? "leaderboard" : "bracket", 
                icon: Layout, 
                label: tournament.category === 'BATTLE_ROYALE' ? "Leaderboard" : "Bracket" 
            },
            { id: "teams", icon: Users, label: "Teams" },
            { id: "mvp", icon: Trophy, label: "MVP" },
            { id: "schedule", icon: Calendar, label: "Schedule" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-2 transition-all group ${
                activeTab === tab.id ? "text-blue-500" : "hover:text-white"
              }`}
            >
              <div className={`p-3 rounded-xl transition-all ${
                activeTab === tab.id ? "bg-blue-500/10" : "group-hover:bg-white/5"
              }`}>
                <tab.icon size={20} />
              </div>
              <span className="text-[8px]">{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-6">
          <button className="p-3 rounded-xl text-gray-600 hover:text-white hover:bg-white/5 transition-all">
            <Bell size={20} />
          </button>
          <button className="p-3 rounded-xl text-gray-600 hover:text-white hover:bg-white/5 transition-all">
            <Settings size={20} />
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* HEADER BAR */}
        <header className="relative w-full overflow-hidden shrink-0 border-b border-white/5">
          {/* Game Banner Background */}
          <div className="absolute inset-0 z-0">
            <Image 
              src={gameMeta?.bannerUrl || ''} 
              fill
              className="object-cover grayscale-[0.3] brightness-[0.4]" 
              alt=""
              style={{ objectPosition: gameMeta?.bannerPosition || 'center' }}
              priority
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0d0f12] via-[#0d0f12]/60 to-transparent"></div>
          </div>

          <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-10 md:py-16 relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8 md:gap-0">
            <div className="flex items-center gap-6 md:gap-10">
              {/* Hamburger Button (Mobile) */}
              <button 
                onClick={() => setIsMenuOpen(true)}
                className="p-2 hover:bg-white/10 rounded-xl transition-all md:hidden text-white bg-black/20 border border-white/10"
              >
                <Menu size={24} />
              </button>

              {/* Game Logo Badge */}
              <div className="w-16 h-16 md:w-24 md:h-24 bg-white/5 backdrop-blur-2xl rounded-2xl md:rounded-[2rem] border border-white/10 flex items-center justify-center p-3 md:p-4 relative shrink-0">
                <Image 
                  src={gameMeta?.logoUrl || ''} 
                  width={64} 
                  height={64} 
                  className="object-contain" 
                  alt={tournament.game} 
                  sizes="64px"
                />
              </div>

              <div>
                <div className="flex items-center gap-4 mb-4">
                  <span className="bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase tracking-[0.3em] px-4 py-1.5 rounded-full border border-blue-500/20">
                    {tournament.game} / {tournament.format}
                  </span>
                  {liveMatches.length > 0 && (
                    <span className="flex items-center gap-2 bg-red-500/10 text-red-500 text-[10px] font-black uppercase tracking-[0.3em] px-4 py-1.5 rounded-full border border-red-500/20 animate-pulse">
                      <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                      Live Now
                    </span>
                  )}
                </div>
                <h1 className="text-3xl sm:text-4xl md:text-7xl font-black uppercase tracking-tighter leading-none mb-4 drop-shadow-2xl">
                  {tournament.name}
                </h1>
                <div className="flex flex-wrap items-center gap-6 md:gap-10 text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] md:tracking-[0.3em]">
                  <div className="flex items-center gap-3">
                    <Users size={14} className="text-blue-500" />
                    <span>{teams.length} Teams Registered</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar size={14} className="text-blue-500" />
                    <span>Ongoing Event</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 w-full md:w-auto">
              <Link
                href={`/tournaments/${id}/register`}
                className="bg-blue-600 hover:bg-blue-500 text-white px-6 md:px-10 py-4 md:py-5 rounded-xl md:rounded-2xl font-black text-[10px] md:text-[12px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-4 shadow-xl shadow-blue-600/30 group"
              >
                Assemble Team <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </header>

        {/* VIEW AREA */}
        <div className="flex-1 overflow-y-auto px-6 md:px-10 py-8 md:py-10 custom-scrollbar">
          {activeTab === "overview" && (
            <div className="space-y-12 max-w-6xl">
              {/* Featured Live Matches */}
              {liveMatches.length > 0 && (
                <section className="space-y-6">
                  <div className="flex items-center gap-4">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.5em] text-red-500">Featured Live</h2>
                    <div className="h-px flex-1 bg-gradient-to-r from-red-500/20 to-transparent"></div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {liveMatches.map((match: any) => (
                      <LiveMatchCard key={match.id} match={match} tournamentId={id} />
                    ))}
                  </div>
                </section>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                 {/* About Card */}
                  <section className="bg-[#16191d] border border-white/5 rounded-[3rem] p-12 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 blur-[80px] rounded-full -mr-32 -mt-32 transition-transform duration-[3000ms] group-hover:scale-150"></div>
                    <h2 className="text-3xl font-extrabold uppercase tracking-tighter mb-8 leading-none">The Ultimate<br/><span className="text-blue-500">Battle Awaits.</span></h2>
                    <p className="text-gray-400 leading-relaxed text-lg max-w-lg">
                      Welcome to the {tournament.name}. Brace yourself for intensive {tournament.teamSize}v{tournament.teamSize} encounters. 
                      Monitor real-time progression, study your rivals, and prepare for the grand finals.
                    </p>
                    
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 mt-16 pt-16 border-t border-white/5">
                      {[
                        { label: "Participants", value: teams.length, unit: "Teams" },
                        { label: "Total Matches", value: matches.length, unit: "Games" },
                        { label: "Active Mode", value: `${tournament.teamSize}v${tournament.teamSize}`, unit: "Players" },
                        { label: "Format", value: tournament.format === 'SINGLE_ELIMINATION' ? 'SE' : 'DE', unit: "Competition" }
                      ].map((stat, i) => (
                        <div key={i}>
                          <span className="block text-[8px] md:text-[10px] font-black uppercase tracking-[0.1em] md:tracking-[0.2em] text-gray-600 mb-2">{stat.label}</span>
                          <div className="flex items-baseline gap-2">
                             <span className="text-xl md:text-2xl font-extrabold text-white">{stat.value}</span>
                             <span className="text-[8px] md:text-[10px] font-bold text-blue-500/50 uppercase">{stat.unit}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Quick Roster Stats / Info */}
                  <div className="space-y-6">
                     <div className="bg-[#16191d] border border-white/5 rounded-[2.5rem] p-10 h-1/2">
                        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-gray-500 mb-8">Registered Teams</h3>
                        <div className="flex flex-wrap gap-4">
                           {teams.slice(0, 10).map((t: any, idx: number) => (
                              <div key={idx} className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/5 hover:border-blue-500/30 transition-all cursor-pointer group overflow-hidden">
                                 {t.logoUrl ? (
                                     <div className="relative w-full h-full"> 
                                        <Image 
                                            src={t.logoUrl} 
                                            alt="" 
                                            fill 
                                            className="object-contain" 
                                            sizes="48px"
                                        />
                                     </div>
                                 ) : (
                                     <Trophy size={20} className="text-gray-700 group-hover:text-blue-500 transition-all" />
                                 )}
                              </div>
                           ))}
                           {teams.length > 10 && (
                              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/5 text-[10px] font-black text-gray-700">
                                 +{teams.length - 10}
                              </div>
                           )}
                        </div>
                        <button 
                          onClick={() => setActiveTab('teams')}
                          className="mt-10 text-[10px] font-black uppercase tracking-widest text-blue-500 hover:text-white transition-all flex items-center gap-2 group"
                        >
                           View All Teams <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                     </div>

                     <div className="bg-blue-600 rounded-[2.5rem] p-10 shadow-lg shadow-blue-600/10 relative overflow-hidden group h-[calc(50%-1.5rem)] flex flex-col justify-center">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-[40px] rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-all duration-700"></div>
                        <h3 className="text-xl font-extrabold uppercase tracking-tighter text-white mb-2">Join the Action</h3>
                        <p className="text-blue-100 text-[11px] font-bold leading-relaxed mb-8 max-w-[200px]">Registration is still open! Form your squad and compete for the {tournament.name} title.</p>
                        <Link 
                          href={`/tournaments/${id}/register`}
                          className="bg-white text-blue-600 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] inline-flex items-center gap-2 hover:shadow-xl transition-all w-fit active:scale-95"
                        >
                           Sign Up Now <ArrowRight size={14} />
                        </Link>
                     </div>
                  </div>
              </div>
            </div>
          )}

          {activeTab === "bracket" && tournament.category !== 'BATTLE_ROYALE' && (
            <div className="h-full w-full bg-[#16191d]/30 border border-white/5 rounded-[2.5rem] overflow-hidden relative group">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.03),transparent)] pointer-events-none"></div>
              <PublicBracket tournamentId={id} matches={matches} />
            </div>
          )}

          {activeTab === "leaderboard" && (
            <div className="h-full w-full bg-[#16191d] border border-white/5 rounded-[3rem] overflow-hidden relative group">
                <header className="px-12 py-10 border-b border-white/5 bg-black/20 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-extrabold uppercase tracking-tight">Main Leaderboard</h2>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">Global Standing • {tournament.game}</p>
                    </div>
                </header>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/[0.02]">
                                <th className="px-12 py-6 text-[10px] font-black text-gray-500 uppercase tracking-widest">Rank</th>
                                <th className="px-12 py-6 text-[10px] font-black text-gray-500 uppercase tracking-widest">Competitor</th>
                                <th className="px-12 py-6 text-[10px] font-black text-gray-500 uppercase tracking-widest">Kills</th>
                                <th className="px-12 py-6 text-[10px] font-black text-gray-500 uppercase tracking-widest">Avg Placement</th>
                                <th className="px-12 py-6 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Total Points</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {[...scoreboard].sort((a, b) => b.points - a.points).map((entry, idx) => (
                                <tr key={entry.id} className="hover:bg-blue-600/[0.02] transition-colors group">
                                    <td className="px-12 py-8 font-black text-xl italic text-gray-700 group-hover:text-blue-500 transition-all">#{idx + 1}</td>
                                    <td className="px-12 py-8">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/5 overflow-hidden relative">
                                                {entry.team?.logoUrl ? (
                                                    <Image 
                                                        src={entry.team.logoUrl} 
                                                        alt="" 
                                                        fill 
                                                        className="object-contain" 
                                                        sizes="48px"
                                                    />
                                                ) : (
                                                    <Trophy size={16} className="text-gray-700" />
                                                )}
                                            </div>
                                            <span className="text-lg font-bold uppercase tracking-tight">{entry.team?.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-12 py-8 text-lg font-bold text-gray-400">{entry.kills}</td>
                                    <td className="px-12 py-8 text-lg font-bold text-gray-400">#{entry.placement}</td>
                                    <td className="px-12 py-8 text-right">
                                        <span className="text-3xl font-black text-blue-500">{entry.points}</span>
                                        <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest ml-4">PTS</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
          )}

          {activeTab === "teams" && (
            <div className="space-y-10">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h2 className="text-4xl font-black uppercase tracking-tighter">Participating <span className="text-blue-500">Teams</span></h2>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mt-2">Verified Roster & Seedings</p>
                </div>
                <div className="relative group w-full md:w-96">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
                  <input
                    type="text"
                    placeholder="Search Teams (e.g. Team 127)..."
                    value={teamSearch}
                    onChange={(e) => setTeamSearch(e.target.value)}
                    className="w-full bg-[#16191d] border border-white/5 rounded-2xl py-5 pl-14 pr-6 text-sm font-bold focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-gray-600"
                  />
                </div>
              </div>

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                 {teams.filter((t: any) => t.name.toLowerCase().includes(teamSearch.toLowerCase())).map((team: any) => (
                    <div key={team.id} className="bg-[#16191d] border border-white/5 rounded-[2.5rem] p-10 hover:border-blue-500/30 transition-all group relative overflow-hidden flex flex-col h-[400px]">
                      <div className="absolute top-0 right-0 w-40 h-40 bg-blue-600/5 blur-[50px] rounded-full -mr-20 -mt-20 group-hover:bg-blue-600/10 transition-all duration-700"></div>
                      
                      <div className="flex items-start justify-between mb-10 shrink-0">
                         <div className="w-20 h-20 bg-black/40 rounded-3xl flex items-center justify-center border border-white/10 group-hover:scale-105 group-hover:border-blue-500/50 transition-all duration-500 shadow-xl overflow-hidden relative">
                            {team.logoUrl ? (
                                 <Image 
                                    src={team.logoUrl} 
                                    alt="" 
                                    fill 
                                    className="object-contain" 
                                    sizes="80px"
                                />
                             ) : (
                                <Users size={32} className="text-gray-500 group-hover:text-blue-500 transition-colors" />
                            )}
                         </div>
                         <div className="flex flex-col items-end gap-2">
                            <span className="text-[9px] font-black text-blue-500 bg-blue-500/10 px-3 py-1 rounded-full uppercase tracking-widest border border-blue-500/20">
                              Verified Squad
                            </span>
                            <span className="text-[10px] font-bold text-gray-700 uppercase tracking-widest">{team.players?.length || 0} MEMBERS</span>
                         </div>
                      </div>

                      <h3 className="text-3xl font-extrabold uppercase tracking-tighter mb-8 group-hover:text-white transition-colors truncate pr-4">{team.name}</h3>
                      
                      <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1 pr-4 -mr-4">
                         {team.players?.map((p: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between group/player py-2 border-b border-white/[0.03] last:border-0">
                               <div className="flex items-center gap-4 truncate">
                                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.3)] opacity-20 group-hover/player:opacity-100 transition-all duration-300"></div>
                                  <span className="text-[12px] font-bold text-gray-400 group-hover/player:text-white transition-all truncate">{p.name}</span>
                               </div>
                               {p.seating && <span className="text-[10px] font-mono text-gray-800 font-bold group-hover/player:text-blue-500/50 transition-all shrink-0 ml-4">{p.seating}</span>}
                            </div>
                         ))}
                      </div>

                      <div className="mt-8 pt-8 border-t border-white/5 shrink-0">
                         <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-gray-700">
                            <span>Status</span>
                            <span className="text-blue-500/50">Active Competitor</span>
                         </div>
                      </div>
                    </div>
                 ))}
               </div>
            </div>
          )}

          {activeTab === "mvp" && (
            <div className="h-full w-full bg-[#16191d] border border-white/5 rounded-[3rem] overflow-hidden relative group">
                <header className="px-12 py-10 border-b border-white/5 bg-black/20 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-extrabold uppercase tracking-tight">Tournament MVP Leaderboard</h2>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">Live Player Performance &bull; 256 Competitors</p>
                    </div>
                </header>

                <div className="overflow-x-auto h-[calc(100%-120px)] custom-scrollbar">
                    <table className="w-full text-left">
                        <thead className="sticky top-0 bg-[#16191d] z-20">
                            <tr className="border-b border-white/5">
                                <th className="px-12 py-6 text-[10px] font-black text-gray-500 uppercase tracking-widest">Rank</th>
                                <th className="px-12 py-6 text-[10px] font-black text-gray-500 uppercase tracking-widest">Player</th>
                                <th className="px-12 py-6 text-[10px] font-black text-gray-500 uppercase tracking-widest">Team</th>
                                <th className="px-12 py-6 text-[10px] font-black text-gray-500 uppercase tracking-widest">Kills</th>
                                <th className="px-12 py-6 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">K/D Rating</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {teams.flatMap((t: any) => t.players?.map((p: any) => ({ ...p, teamName: t.name })) || [])
                              .map((p: any) => ({
                                ...p,
                                kills: Math.floor((p.id.length * 7 + p.name.length * 3) % 40),
                                kd: parseFloat(((p.id.length * 0.13 + p.name.length * 0.07) % 2.5 + 0.5).toFixed(2))
                              }))
                              .sort((a: any, b: any) => b.kd - a.kd)
                              .map((player: any, idx: number) => (
                                <tr key={player.id || idx} className="hover:bg-blue-600/[0.02] transition-colors group">
                                    <td className="px-12 py-6 font-black text-xl italic text-gray-700 group-hover:text-blue-500 transition-all">#{idx + 1}</td>
                                    <td className="px-12 py-6">
                                        <span className="text-sm font-bold uppercase tracking-tight">{player.name}</span>
                                    </td>
                                    <td className="px-12 py-6">
                                        <span className="text-xs font-black text-gray-600 uppercase tracking-widest">{player.teamName}</span>
                                    </td>
                                    <td className="px-12 py-6 text-sm font-bold text-gray-400">{player.kills}</td>
                                    <td className="px-12 py-6 text-right">
                                        <span className="text-2xl font-black text-blue-500">{player.kd}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
          )}

          {activeTab === "schedule" && (
               <div className="max-w-4xl space-y-20 pb-20">
                 {[...new Set(matches.map((m: any) => m.round))].sort((a: any, b: any) => a - b).map((round: any) => (
                    <div key={round} className="space-y-10">
                       <div className="flex items-center gap-8">
                          <div className="bg-[#16191d] px-8 py-3 rounded-2xl border border-white/5 shadow-xl">
                             <h2 className="text-[11px] font-black uppercase tracking-[0.5em] text-blue-500">Qualifiers Round {round}</h2>
                          </div>
                          <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent"></div>
                       </div>
                       
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {matches.filter((m: any) => m.round === round).map((match: any) => (
                             <div key={match.id} className="bg-[#16191d] border border-white/5 rounded-[2rem] p-8 flex items-center justify-between group hover:border-blue-500/20 hover:bg-[#1c2025] transition-all duration-300 relative overflow-hidden">
                                <div className="absolute inset-0 bg-blue-600/[0.01] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                
                                <div className="flex items-center gap-6 flex-1 relative z-10">
                                   <div className="flex-1 text-right overflow-hidden flex flex-col items-end">
                                      <div className="flex items-center gap-3 justify-end w-full">
                                         <span className="text-[13px] font-extrabold uppercase tracking-tighter group-hover:text-white transition-all truncate">{match.homeTeam?.name || "Pending"}</span>
                                         <div className="w-6 h-6 rounded-lg bg-white/5 flex-shrink-0 flex items-center justify-center overflow-hidden border border-white/5 relative">
                                            {match.homeTeam?.logoUrl ? (
                                                <Image 
                                                    src={match.homeTeam.logoUrl} 
                                                    alt="" 
                                                    fill 
                                                    className="object-contain" 
                                                    sizes="24px"
                                                />
                                            ) : (
                                                <Trophy size={10} className="text-gray-700" />
                                            )}
                                         </div>
                                      </div>
                                      <span className="text-[8px] font-bold text-gray-700 uppercase mt-1">Home</span>
                                   </div>

                                   <div className="flex flex-col items-center gap-2 w-24 shrink-0 px-4 border-x border-white/5">
                                      <span className={`text-2xl font-extrabold font-mono tracking-tighter ${match.status === 'LIVE' ? 'text-red-500' : 'text-white'}`}>
                                         {match.homeScore} <span className="text-gray-800 mx-1">:</span> {match.awayScore}
                                      </span>
                                      <div className={`px-2.5 py-1 rounded-full flex items-center gap-1.5 ${
                                        match.status === 'COMPLETED' ? 'bg-black/40 text-gray-600' : 
                                        match.status === 'LIVE' ? 'bg-red-500/10 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.1)]' :
                                        'bg-blue-600/10 text-blue-500'
                                      }`}>
                                        {match.status === 'LIVE' && <div className="w-1 h-1 bg-red-500 rounded-full animate-pulse"></div>}
                                        <span className="text-[8px] font-black uppercase tracking-widest">{match.status}</span>
                                      </div>
                                   </div>

                                   <div className="flex-1 text-left overflow-hidden flex flex-col items-start">
                                      <div className="flex items-center gap-3 justify-start w-full">
                                          <div className="w-6 h-6 rounded-lg bg-white/5 flex-shrink-0 flex items-center justify-center overflow-hidden border border-white/5 relative">
                                             {match.awayTeam?.logoUrl ? (
                                                 <Image 
                                                    src={match.awayTeam.logoUrl} 
                                                    alt="" 
                                                    fill 
                                                    className="object-contain" 
                                                    sizes="24px"
                                                />
                                             ) : (
                                                <Trophy size={10} className="text-gray-700" />
                                            )}
                                         </div>
                                         <span className="text-[13px] font-extrabold uppercase tracking-tighter group-hover:text-white transition-all truncate">{match.awayTeam?.name || "Pending"}</span>
                                      </div>
                                      <span className="text-[8px] font-bold text-gray-700 uppercase mt-1">Away</span>
                                   </div>
                                </div>
                             </div>
                          ))}
                       </div>
                    </div>
                 ))}
               </div>
          )}
        </div>
      </div>

      {/* RIGHT SIDEBAR (LIVE/STATS) */}
      <aside className="hidden lg:flex w-80 bg-[#16191d] border-l border-white/5 flex-col p-8 shrink-0 relative overflow-hidden">
         <div className="absolute top-0 right-0 w-32 h-64 bg-blue-600/5 blur-[60px] rounded-full pointer-events-none"></div>
         
         <div className="mb-10 flex items-center justify-between">
            <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-500">Tournament Progress</h3>
            <span className="text-[11px] font-black text-blue-500">75%</span>
         </div>
         <div className="w-full h-1.5 bg-white/5 rounded-full mb-12 overflow-hidden border border-white/5">
            <div className="h-full bg-blue-600 w-3/4 shadow-[0_0_15px_rgba(37,99,235,0.5)]"></div>
         </div>

         <div className="flex flex-col flex-1 gap-12 overflow-y-auto no-scrollbar">
            {/* LIVE SECTION */}
            <section>
               <div className="flex items-center gap-3 mb-6">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]"></div>
                  <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-red-500">Live Matches</h4>
               </div>
               
               <div className="space-y-4">
                  {liveMatches.length > 0 ? (
                    liveMatches.map((match: any) => (
                      <div key={match.id} className="bg-black/30 border border-white/5 rounded-2xl p-5 hover:border-blue-500/30 transition-all group">
                         <div className="flex justify-between items-center mb-4">
                            <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest group-hover:text-white transition-all">BO{match.bestOf} &bull; R{match.round}</span>
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                         </div>
                         <div className="flex flex-col gap-3">
                            <div className="flex justify-between items-center">
                               <span className="text-sm font-extrabold uppercase tracking-tighter truncate w-24">{match.homeTeam?.name || "TBD"}</span>
                               <span className="text-xl font-extrabold font-mono text-blue-500">{match.homeScore}</span>
                            </div>
                            <div className="flex justify-between items-center">
                               <span className="text-sm font-extrabold uppercase tracking-tighter truncate w-24 text-gray-500">{match.awayTeam?.name || "TBD"}</span>
                               <span className="text-xl font-extrabold font-mono text-gray-500">{match.awayScore}</span>
                            </div>
                         </div>
                         <Link 
                           href={`/bracket/${id}/overlay`}
                           target="_blank"
                           className="mt-5 w-full bg-white/5 hover:bg-white/10 py-3 rounded-xl flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-widest transition-all text-gray-400 hover:text-white"
                         >
                           <Play size={10} fill="currentColor" /> Watch Stream
                         </Link>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-10 border border-dashed border-white/5 rounded-2xl">
                       <p className="text-[10px] font-bold text-gray-700 uppercase tracking-widest">No Matches Currently Live</p>
                    </div>
                  )}
               </div>
            </section>

            {/* UPCOMING / RECENT SECTION */}
            <section>
               <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-500 mb-6">Upcoming</h4>
               <div className="space-y-4">
                  {matches.filter((m: any) => m.status === 'PENDING').slice(0, 3).map((match: any) => (
                    <div key={match.id} className="bg-white/5 border border-white/5 rounded-2xl p-5 group hover:bg-white/[0.08] transition-all">
                       <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] font-black uppercase tracking-tighter truncate w-24 group-hover:text-blue-400 transition-all">{match.homeTeam?.name || "TBD"}</span>
                          <span className="text-[9px] font-bold text-gray-700">VS</span>
                          <span className="text-[10px] font-black uppercase tracking-tighter truncate w-24 text-right group-hover:text-blue-400 transition-all">{match.awayTeam?.name || "TBD"}</span>
                       </div>
                    </div>
                  ))}
               </div>
            </section>
         </div>

         <div className="mt-8 pt-8 border-t border-white/5 text-center">
            <p className="text-[9px] font-black text-white/10 uppercase tracking-[0.5em]">ApexPlay Tech</p>
         </div>
      </aside>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(59, 130, 246, 0.2);
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
