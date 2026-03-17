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
   const [selectedTeam, setSelectedTeam] = useState<any>(null);
   const [selectedMatch, setSelectedMatch] = useState<any>(null);
   const [selectedPlayer, setSelectedPlayer] = useState<any>(null);

    const getFlagUrl = (countryCode: string | null) => {
        if (!countryCode) return null;
        const code = countryCode.toLowerCase();
        const mapping: { [key: string]: number } = {
            'no': 129,
            'se': 151,
            'dk': 84,
            'fi': 90,
            'is': 103,
            'de': 163,
            'gb': 150,
            'us': 166,
            'ca': 109,
            'au': 15
        };
        const id = mapping[code];
        if (!id) return null;
        return `https://dynamic.fragbite.se/flags/4x3/${id}.svg`;
    };

    const formatPlayerName = (player: any) => {
        if (!player) return null;
        
        const flagUrl = getFlagUrl(player.countryCode);
        const nameParts = player.name.trim().split(/\s+/);
        let displayName = player.name;

        if (player.nickname && player.nickname.trim() !== "") {
            if (nameParts.length >= 2) {
                const firstName = nameParts[0];
                const lastName = nameParts.slice(1).join(" ");
                displayName = `${firstName} "${player.nickname}" ${lastName}`;
            } else {
                displayName = `${player.name} "${player.nickname}"`;
            }
        }

        return (
            <span className="flex items-center gap-2">
                {flagUrl && (
                    <img 
                      src={flagUrl} 
                      alt="" 
                      className="w-4 h-3 object-cover rounded-[1px] opacity-80 group-hover:opacity-100 transition-opacity" 
                    />
                )}
                <span>{displayName}</span>
            </span>
        );
    };

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
                    <span>{teams.length} Participants</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Gamepad2 size={14} className="text-blue-500" />
                    <span>{matches.length} Total Matches</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Trophy size={14} className="text-blue-500" />
                    <span>{tournament.teamSize}v{tournament.teamSize} Mode</span>
                  </div>
                   <div className="flex items-center gap-3">
                    <Layout size={14} className="text-blue-500" />
                    <span>{tournament.format} Format</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 w-full md:w-auto">
              {tournament.status === 'UPCOMING' && (
                <Link
                  href={`/tournaments/${id}/register`}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-6 md:px-10 py-4 md:py-5 rounded-xl md:rounded-2xl font-black text-[10px] md:text-[12px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-4 shadow-xl shadow-blue-600/30 group"
                >
                  Assemble Team <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </Link>
              )}
            </div>
          </div>
        </header>

        {/* VIEW AREA */}
        <div className="flex-1 overflow-y-auto px-6 md:px-10 py-8 md:py-10 custom-scrollbar">
          {activeTab === "overview" && (
            <div className="space-y-12">
              {/* Featured Live Matches */}
              {liveMatches.length > 0 && (
                <section className="space-y-6 max-w-6xl">
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

              <div className="space-y-6">
                  <div className="bg-[#16191d] border border-white/5 rounded-[2.5rem] p-10 overflow-hidden flex flex-col min-h-[500px]">
                    <div className="flex items-center justify-between mb-10">
                        <div>
                          <h3 className="text-xs font-black uppercase tracking-[0.3em] text-gray-500 mb-2">Registered Teams ({teams.length})</h3>
                          <p className="text-[10px] font-bold text-blue-500/50 uppercase tracking-widest">Global Competitor Roster</p>
                        </div>
                        <button 
                          onClick={() => setActiveTab('teams')}
                          className="text-[10px] font-black uppercase tracking-widest text-blue-500 hover:text-white transition-all flex items-center gap-2 group border border-blue-500/20 px-6 py-3 rounded-xl bg-blue-500/5 hover:bg-blue-600 hover:border-blue-600 shadow-lg shadow-blue-500/10"
                        >
                           View Detailed Directory <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>

                    <div className="flex flex-wrap gap-5 max-h-[800px] overflow-y-auto custom-scrollbar pb-8 pr-4">
                        {teams.map((t: any, idx: number) => (
                          <div 
                            key={idx} 
                            onClick={() => setSelectedTeam(t)}
                            className="w-24 h-24 bg-white/5 rounded-[2rem] flex items-center justify-center border border-white/5 hover:border-blue-500/40 hover:bg-white/10 transition-all cursor-pointer group overflow-hidden shrink-0 shadow-2xl relative"
                          >
                              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/0 to-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                              {t.logoUrl ? (
                                  <div className="relative w-full h-full p-3"> 
                                    <Image 
                                        src={t.logoUrl} 
                                        alt="" 
                                        fill 
                                        className="object-contain transition-transform duration-500 group-hover:scale-110" 
                                        sizes="96px"
                                    />
                                  </div>
                              ) : (
                                  <Trophy size={40} className="text-gray-700 group-hover:text-blue-500 transition-all duration-500" />
                              )}
                          </div>
                        ))}
                    </div>
                  </div>
              </div>
            </div>
          )}

          {activeTab === "bracket" && tournament.category !== 'BATTLE_ROYALE' && (
            <div className="h-full w-full bg-[#16191d]/30 border border-white/5 rounded-[2.5rem] overflow-hidden relative group">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.03),transparent)] pointer-events-none"></div>
              <PublicBracket 
                tournamentId={id} 
                matches={matches} 
                onMatchClick={(matchId) => setSelectedMatch(matches.find((m: any) => m.id === matchId))}
              />
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
                    <div key={team.id} className="bg-[#16191d] border border-white/5 rounded-[2.5rem] p-8 hover:border-blue-500/30 transition-all group relative overflow-hidden flex flex-col">
                      <div className="absolute top-0 right-0 w-40 h-40 bg-blue-600/5 blur-[50px] rounded-full -mr-20 -mt-20 group-hover:bg-blue-600/10 transition-all duration-700"></div>
                      
                      <div className="flex items-center justify-between mb-8 shrink-0">
                         <div className="flex items-center gap-6">
                            <div className="w-20 h-20 bg-black/40 rounded-3xl flex items-center justify-center border border-white/10 group-hover:scale-105 group-hover:border-blue-500/50 transition-all duration-500 shadow-xl overflow-hidden relative flex-shrink-0">
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
                            <h3 className="text-3xl font-black uppercase tracking-tighter group-hover:text-white transition-colors leading-tight truncate max-w-[150px] lg:max-w-[200px]">{team.name}</h3>
                         </div>
                         <div className="flex flex-col items-end gap-2">
                            <span className="text-[9px] font-black text-blue-500 bg-blue-500/10 px-3 py-1 rounded-full uppercase tracking-widest border border-blue-500/20">
                              Verified Squad
                            </span>
                            <span className="text-[10px] font-bold text-gray-700 uppercase tracking-widest">{team.players?.length || 0} MEMBERS</span>
                         </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-6 shrink-0">
                          {team.players?.map((p: any, idx: number) => (
                             <div 
                              key={idx} 
                              onClick={() => setSelectedPlayer({ ...p, teamName: team.name })}
                              className="bg-black/20 p-4 rounded-2xl border border-white/5 group/player hover:border-blue-500/30 transition-all cursor-pointer"
                             >
                                <div className="flex flex-col gap-1">
                                   <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest leading-none mb-1">Player {idx + 1}</span>
                                   <span className="text-sm font-bold text-gray-300 group-hover/player:text-white transition-all truncate">{formatPlayerName(p)}</span>
                                </div>
                             </div>
                          ))}
                      </div>

                      <button 
                        onClick={() => setSelectedTeam(team)}
                        className="w-full bg-white/5 hover:bg-blue-600 text-[10px] font-black uppercase tracking-widest py-4 rounded-xl transition-all border border-white/5 hover:border-blue-600 text-gray-400 hover:text-white flex items-center justify-center gap-2 group/btn"
                      >
                        Team Details <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                      </button>
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
                                <tr 
                                  key={player.id || idx} 
                                  onClick={() => setSelectedPlayer(player)}
                                  className={`hover:bg-blue-600/[0.02] transition-colors group cursor-pointer ${idx < 3 ? 'bg-blue-500/[0.02]' : ''}`}
                                >
                                    <td className="px-12 py-6">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black italic text-sm ${
                                        idx === 0 ? 'bg-yellow-500 text-black shadow-[0_0_15px_rgba(234,179,8,0.4)]' :
                                        idx === 1 ? 'bg-gray-300 text-black shadow-[0_0_15px_rgba(209,213,219,0.4)]' :
                                        idx === 2 ? 'bg-orange-600 text-white shadow-[0_0_15px_rgba(194,65,12,0.4)]' :
                                        'text-gray-700 group-hover:text-blue-500'
                                      }`}>
                                        #{idx + 1}
                                      </div>
                                    </td>
                                    <td className="px-12 py-6">
                                        <span className="text-sm font-bold uppercase tracking-tight group-hover:text-blue-500 transition-all">{formatPlayerName(player)}</span>
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
                          {matches.filter((m: any) => m.round === round).sort((a: any, b: any) => a.matchOrder - b.matchOrder).map((match: any, idx: number) => (
                             <div key={match.id} className="bg-[#16191d] border border-white/5 rounded-[2rem] p-8 flex items-center justify-between group hover:border-blue-500/20 hover:bg-[#1c2025] transition-all duration-300 relative overflow-hidden">
                                <div className="absolute inset-0 bg-blue-600/[0.01] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <div className="absolute top-0 left-0 bg-blue-600/10 text-blue-500 text-[8px] font-black px-3 py-1 rounded-br-xl border-r border-b border-white/5 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                   GAME #{idx + 1}
                                </div>
                                
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
         
         {/* TOURNAMENT PROGRESS */}
         {(() => {
           const total = matches.length;
           const completed = matches.filter((m: any) => m.status === 'COMPLETED').length;
           const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
           
           return (
             <>
               <div className="mb-10 flex items-center justify-between">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-500">Tournament Progress</h3>
                  <span className="text-[11px] font-black text-blue-500">{progress}%</span>
               </div>
               <div className="w-full h-1.5 bg-white/5 rounded-full mb-12 overflow-hidden border border-white/5">
                  <div 
                    className="h-full bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.5)] transition-all duration-1000" 
                    style={{ width: `${progress}%` }}
                  ></div>
               </div>
             </>
           );
         })()}

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
                  {matches
                    .filter((m: any) => m.status === 'PENDING' || m.status === 'READY')
                    .sort((a: any, b: any) => {
                      if (a.round !== b.round) return a.round - b.round;
                      return a.matchOrder - b.matchOrder;
                    })
                    .slice(0, 5)
                    .map((match: any) => (
                    <div key={match.id} className="bg-white/5 border border-white/5 rounded-2xl p-5 group hover:bg-white/[0.08] transition-all relative overflow-hidden">
                       <div className="absolute top-0 left-0 bg-blue-600/10 text-blue-500 text-[7px] font-black px-2 py-0.5 rounded-br-lg">R{match.round}</div>
                       <div className="flex justify-between items-center mt-2">
                          <span className="text-[10px] font-black uppercase tracking-tighter truncate w-24 group-hover:text-blue-400 transition-all">{match.homeTeam?.name || "TBD"}</span>
                          <span className="text-[9px] font-bold text-gray-700">VS</span>
                          <span className="text-[10px] font-black uppercase tracking-tighter truncate w-24 text-right group-hover:text-blue-400 transition-all">{match.awayTeam?.name || "TBD"}</span>
                       </div>
                    </div>
                  ))}
                  {matches.filter((m: any) => m.status === 'PENDING' || m.status === 'READY').length === 0 && (
                    <div className="text-center py-8 border border-dashed border-white/5 rounded-2xl opacity-50">
                       <p className="text-[8px] font-bold text-gray-700 uppercase tracking-widest">Bracket Fully Completed</p>
                    </div>
                  )}
               </div>
            </section>
         </div>

         <div className="mt-8 pt-8 border-t border-white/5 text-center">
            <p className="text-[9px] font-black text-white/10 uppercase tracking-[0.5em]">ApexPlay Tech</p>
         </div>
      </aside>

      {/* TEAM DETAILS MODAL */}
      {selectedTeam && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 sm:p-10">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setSelectedTeam(null)}></div>
          <div className="bg-[#16191d] w-full max-w-4xl max-h-[90vh] rounded-[3rem] border border-white/10 shadow-2xl relative z-10 flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            <header className="p-10 border-b border-white/5 flex items-start justify-between">
              <div className="flex items-center gap-8">
                <div className="w-24 h-24 bg-black/40 rounded-3xl flex items-center justify-center border border-white/10 shadow-xl overflow-hidden relative">
                  {selectedTeam.logoUrl ? (
                    <Image src={selectedTeam.logoUrl} alt="" fill className="object-contain" sizes="96px" />
                  ) : (
                    <Users size={40} className="text-gray-500" />
                  )}
                </div>
                <div>
                  <h2 className="text-5xl font-black uppercase tracking-tighter leading-none mb-4">{selectedTeam.name}</h2>
                  <div className="flex items-center gap-6 text-[10px] font-black text-blue-500 uppercase tracking-widest">
                    <span>{selectedTeam.players?.length || 0} Registered Members</span>
                    <span>&bull;</span>
                    <span>Seed #{selectedTeam.seed || 'N/A'}</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setSelectedTeam(null)}
                className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all text-gray-500 hover:text-white border border-white/5"
              >
                <X size={24} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-10 custom-scrollbar grid grid-cols-1 md:grid-cols-2 gap-10">
              <section className="space-y-6">
                <h3 className="text-[10px] font-black uppercase tracking-[0.5em] text-gray-500 border-b border-white/5 pb-4">Roster & Stats</h3>
                {selectedTeam.players?.map((p: any, idx: number) => (
                  <div key={idx} className="bg-black/20 p-6 rounded-[2rem] border border-white/5 flex items-center justify-between group/p">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-600/10 rounded-xl flex items-center justify-center text-blue-500 font-bold text-xs border border-blue-500/20">
                        P{idx + 1}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2 mb-1">
                          {getFlagUrl(p.countryCode) && (
                            <img 
                              src={getFlagUrl(p.countryCode)!} 
                              alt="" 
                              className="w-4 h-3 object-cover rounded-[1px] opacity-80 group-hover/p:opacity-100 transition-opacity" 
                            />
                          )}
                          <span className="text-lg font-bold uppercase tracking-tight group-hover/p:text-blue-500 transition-all">
                            {p.nickname || p.name.split(' ')[0]}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest leading-none">
                          {p.name}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                       {/* Deterministic mock stats consistent with MVP tab */}
                       <div className="text-[8px] font-black text-gray-700 uppercase tracking-widest mb-1">Impact Rating</div>
                       <span className="text-xl font-black text-white">{( (p.id.length * 0.13 + p.name.length * 0.07) % 2.5 + 0.5).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </section>

              <section className="space-y-6">
                <h3 className="text-[10px] font-black uppercase tracking-[0.5em] text-gray-500 border-b border-white/5 pb-4">Tournament History</h3>
                <div className="space-y-4">
                  {matches.filter((m: any) => m.homeTeamId === selectedTeam.id || m.awayTeamId === selectedTeam.id)
                    .sort((a: any, b: any) => b.round - a.round)
                    .map((m: any) => {
                      const isHome = m.homeTeamId === selectedTeam.id;
                      const opponent = isHome ? m.awayTeam?.name : m.homeTeam?.name;
                      const won = (isHome && m.homeScore > m.awayScore) || (!isHome && m.awayScore > m.homeScore);
                      
                      return (
                        <div 
                          key={m.id} 
                          onClick={() => setSelectedMatch(m)}
                          className="bg-white/5 p-5 rounded-2xl border border-white/5 flex items-center justify-between hover:border-blue-500/30 cursor-pointer group/hist transition-all"
                        >
                          <div className="flex flex-col gap-1">
                            <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">Round {m.round}</span>
                            <span className="text-[12px] font-bold text-gray-400 group-hover/hist:text-white transition-all">vs <span className="text-white uppercase">{opponent || 'TBD'}</span></span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex flex-col items-end">
                               <span className="text-xl font-black font-mono tracking-tighter">
                                 {m.homeScore} : {m.awayScore}
                               </span>
                               <span className={`text-[8px] font-black uppercase tracking-widest ${won ? 'text-blue-500' : 'text-red-500'}`}>
                                 {won ? 'Victory' : 'Defeat'}
                               </span>
                            </div>
                            <ArrowRight size={14} className="text-gray-700 group-hover/hist:translate-x-1 group-hover/hist:text-blue-500 transition-all" />
                          </div>
                        </div>
                      );
                    })}
                  {matches.filter((m: any) => m.homeTeamId === selectedTeam.id || m.awayTeamId === selectedTeam.id).length === 0 && (
                    <div className="text-center py-10 border border-dashed border-white/5 rounded-2xl">
                       <p className="text-[10px] font-bold text-gray-700 uppercase tracking-widest">No Matches Found</p>
                    </div>
                  )}
                </div>
              </section>
            </div>
            
            <footer className="p-10 bg-black/20 border-t border-white/5 flex justify-end">
               <button 
                onClick={() => setSelectedTeam(null)}
                className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-600/20 active:scale-95"
               >
                 Close Overview
               </button>
            </footer>
          </div>
        </div>
      )}

      {/* PLAYER DETAILS MODAL */}
      {selectedPlayer && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 sm:p-10">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setSelectedPlayer(null)}></div>
          <div className="bg-[#16191d] w-full max-w-2xl rounded-[3.5rem] border border-white/10 shadow-2xl relative z-10 flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            <header className="p-12 border-b border-white/5 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-[80px] rounded-full -mr-32 -mt-32"></div>
               <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-8">
                     <div className="w-20 h-20 bg-blue-600/20 rounded-[2rem] flex items-center justify-center border border-blue-500/30 text-blue-500 shadow-2xl shadow-blue-500/10">
                        <Users size={32} />
                     </div>
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                           {selectedPlayer && getFlagUrl(selectedPlayer.countryCode) && (
                             <img 
                               src={getFlagUrl(selectedPlayer.countryCode)!} 
                               alt="" 
                               className="w-8 h-6 rounded-md object-cover shadow-sm"
                             />
                           )}
                           <h2 className="text-4xl font-black uppercase tracking-tighter">
                             {selectedPlayer.nickname || selectedPlayer.name.split(' ')[0]}
                           </h2>
                        </div>
                        <p className="text-gray-500 text-sm font-bold uppercase tracking-widest mb-4">
                           {selectedPlayer.name}
                        </p>
                        <div className="flex items-center gap-4 text-[10px] font-black text-blue-500 uppercase tracking-widest">
                           <Trophy size={14} />
                           <span>{selectedPlayer.teamName}</span>
                           <span>&bull;</span>
                           <span>Rank #{[...teams.flatMap((t: any) => t.players?.map((p: any) => ({ ...p, teamName: t.name })) || [])]
                               .map((p: any) => ({
                                 ...p,
                                 kd: parseFloat(((p.id.length * 0.13 + p.name.length * 0.07) % 2.5 + 0.5).toFixed(2))
                               }))
                               .sort((a: any, b: any) => b.kd - a.kd)
                               .findIndex(p => p.id === selectedPlayer.id) + 1}</span>
                        </div>
                      </div>
                  </div>
                  <button 
                    onClick={() => setSelectedPlayer(null)}
                    className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all text-gray-500 hover:text-white border border-white/5"
                  >
                    <X size={24} />
                  </button>
               </div>
            </header>

            <div className="p-12 space-y-12">
               <div className="grid grid-cols-3 gap-8">
                  <div className="bg-black/20 p-8 rounded-[2rem] border border-white/5 text-center">
                     <span className="block text-[10px] font-black text-gray-600 uppercase tracking-widest mb-4">K/D Ratio</span>
                     <span className="text-4xl font-black text-blue-500">{selectedPlayer.kd || ( (selectedPlayer.id.length * 0.13 + selectedPlayer.name.length * 0.07) % 2.5 + 0.5).toFixed(2)}</span>
                  </div>
                  <div className="bg-black/20 p-8 rounded-[2rem] border border-white/5 text-center">
                     <span className="block text-[10px] font-black text-gray-600 uppercase tracking-widest mb-4">Total Kills</span>
                     <span className="text-4xl font-black text-white">{selectedPlayer.kills || Math.floor((selectedPlayer.id.length * 7 + selectedPlayer.name.length * 3) % 40)}</span>
                  </div>
                  <div className="bg-black/20 p-8 rounded-[2rem] border border-white/5 text-center">
                     <span className="block text-[10px] font-black text-gray-600 uppercase tracking-widest mb-4">Impact</span>
                     <span className="text-4xl font-black text-blue-500">{(selectedPlayer.kd * 100 || 120).toFixed(0)}</span>
                  </div>
               </div>

               <section className="space-y-6">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.5em] text-gray-500">Recent Performance</h3>
                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                     <div className="h-full bg-blue-600 w-4/5 shadow-[0_0_15px_rgba(37,99,235,0.5)]"></div>
                  </div>
                  <p className="text-gray-500 text-[11px] font-bold leading-relaxed">
                     {formatPlayerName(selectedPlayer)} has been showing exceptional form in the recent rounds, maintaining high impact and supporting the squad effectively. Currently one of the top contenders for the Tournament MVP title.
                  </p>
               </section>
            </div>

            <footer className="p-12 bg-black/20 border-t border-white/5 flex justify-end">
               <button 
                onClick={() => setSelectedPlayer(null)}
                className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-5 rounded-2xl text-[12px] font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-600/30 active:scale-95"
               >
                 Close Profile
               </button>
            </footer>
          </div>
        </div>
      )}

      {/* MATCH DETAILS MODAL */}
      {selectedMatch && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 sm:p-10">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setSelectedMatch(null)}></div>
          <div className="bg-[#16191d] w-full max-w-4xl max-h-[90vh] rounded-[3rem] border border-white/10 shadow-2xl relative z-10 flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            <header className="p-10 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="w-12 h-12 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-500 border border-blue-500/20">
                  <Gamepad2 size={24} />
                </div>
                <div>
                  <h2 className="text-3xl font-black uppercase tracking-tighter">Match Details</h2>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">Round {selectedMatch.round} &bull; {selectedMatch.status}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedMatch(null)}
                className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all text-gray-500 hover:text-white border border-white/5"
              >
                <X size={24} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-10 mb-16">
                 {/* Home Team */}
                 <div className="flex flex-col items-center gap-6 text-center">
                    <div className="w-24 h-24 bg-black/40 rounded-3xl flex items-center justify-center border border-white/10 shadow-xl overflow-hidden relative">
                      {selectedMatch.homeTeam?.logoUrl ? (
                        <Image src={selectedMatch.homeTeam.logoUrl} alt="" fill className="object-contain" sizes="96px" />
                      ) : (
                        <Trophy size={40} className="text-gray-500" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-2xl font-black uppercase tracking-tight mb-2">{selectedMatch.homeTeam?.name || 'TBD'}</h3>
                      <span className="text-[10px] font-black text-blue-500/50 uppercase tracking-widest">Home Contender</span>
                    </div>
                 </div>

                 {/* Score / VS */}
                 <div className="flex flex-col items-center gap-6">
                    <div className="flex items-center gap-8">
                       <span className={`text-7xl font-black font-mono tracking-tighter ${selectedMatch.homeScore > selectedMatch.awayScore ? 'text-blue-500' : 'text-white/40'}`}>
                         {selectedMatch.homeScore}
                       </span>
                       <span className="text-4xl font-black text-gray-800">:</span>
                       <span className={`text-7xl font-black font-mono tracking-tighter ${selectedMatch.awayScore > selectedMatch.homeScore ? 'text-blue-500' : 'text-white/40'}`}>
                         {selectedMatch.awayScore}
                       </span>
                    </div>
                    <div className={`px-6 py-2 rounded-full border ${
                      selectedMatch.status === 'LIVE' ? 'bg-red-500/10 border-red-500/20 text-red-500 animate-pulse' : 'bg-white/5 border-white/10 text-gray-500'
                    }`}>
                      <span className="text-[10px] font-black uppercase tracking-[0.3em]">{selectedMatch.status}</span>
                    </div>
                 </div>

                 {/* Away Team */}
                 <div className="flex flex-col items-center gap-6 text-center">
                    <div className="w-24 h-24 bg-black/40 rounded-3xl flex items-center justify-center border border-white/10 shadow-xl overflow-hidden relative">
                      {selectedMatch.awayTeam?.logoUrl ? (
                        <Image src={selectedMatch.awayTeam.logoUrl} alt="" fill className="object-contain" sizes="96px" />
                      ) : (
                        <Trophy size={40} className="text-gray-500" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-2xl font-black uppercase tracking-tight mb-2">{selectedMatch.awayTeam?.name || 'TBD'}</h3>
                      <span className="text-[10px] font-black text-blue-500/50 uppercase tracking-widest">Away Contender</span>
                    </div>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 border-t border-white/5 pt-16">
                 <section className="space-y-6">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.5em] text-gray-500 mb-8">Home Stats (Simulated)</h4>
                    {selectedMatch.homeTeam?.players?.map((p: any, idx: number) => (
                      <div key={idx} className="bg-black/20 p-6 rounded-2xl border border-white/5 flex items-center justify-between">
                        <span className="text-sm font-bold uppercase text-gray-400">{formatPlayerName(p)}</span>
                        <div className="flex items-center gap-8">
                           <div className="text-right">
                              <div className="text-[8px] font-black text-gray-700 uppercase mb-1">K/D</div>
                              <span className="text-lg font-black text-white">{( (p.id.length * 0.13 + p.name.length * 0.07) % 2.5 + 0.5).toFixed(2)}</span>
                           </div>
                           <div className="text-right">
                              <div className="text-[8px] font-black text-gray-700 uppercase mb-1">Impact</div>
                              <span className="text-lg font-black text-blue-500">{Math.floor((p.id.length * 7 + p.name.length * 3) % 40)}</span>
                           </div>
                        </div>
                      </div>
                    ))}
                 </section>

                 <section className="space-y-6">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.5em] text-gray-500 mb-8">Away Stats (Simulated)</h4>
                    {selectedMatch.awayTeam?.players?.map((p: any, idx: number) => (
                      <div key={idx} className="bg-black/20 p-6 rounded-2xl border border-white/5 flex items-center justify-between">
                        <span className="text-sm font-bold uppercase text-gray-400">{formatPlayerName(p)}</span>
                        <div className="flex items-center gap-8">
                           <div className="text-right">
                              <div className="text-[8px] font-black text-gray-700 uppercase mb-1">K/D</div>
                              <span className="text-lg font-black text-white">{( (p.id.length * 0.13 + p.name.length * 0.07) % 2.5 + 0.5).toFixed(2)}</span>
                           </div>
                           <div className="text-right">
                              <div className="text-[8px] font-black text-gray-700 uppercase mb-1">Impact</div>
                              <span className="text-lg font-black text-blue-500">{Math.floor((p.id.length * 7 + p.name.length * 3) % 40)}</span>
                           </div>
                        </div>
                      </div>
                    ))}
                 </section>
              </div>
            </div>

            <footer className="p-10 bg-black/20 border-t border-white/5 flex justify-end">
               <button 
                onClick={() => setSelectedMatch(null)}
                className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-600/20 active:scale-95"
               >
                 Close Details
               </button>
            </footer>
          </div>
        </div>
      )}

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
