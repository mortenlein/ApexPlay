'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, UserPlus, Trophy, Trash2, Send, Sword, Check, X, ShieldAlert, Settings2, Users, Gamepad2, ExternalLink, Circle, Share2, Copy, Menu } from 'lucide-react';
import { getMapPool, getGameMetadata } from '@/lib/games';
import { useMatchStream } from '@/hooks/useMatchStream';

interface TournamentManageClientProps {
    tournamentId: string;
}

export default function TournamentManageClient({ tournamentId }: TournamentManageClientProps) {
    const queryClient = useQueryClient();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');
    const [newTeam, setNewTeam] = useState({ name: '', logoUrl: '', seed: '', players: Array(10).fill({ name: '', seating: '', steamId: '' }) });
    const [generating, setGenerating] = useState(false);
    const [editingTeam, setEditingTeam] = useState<any>(null);
    const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

    // Modal state
    const [editingMatch, setEditingMatch] = useState<any>(null);
    const [editingScoreboard, setEditingScoreboard] = useState<any>(null);
    const [matchForm, setMatchForm] = useState({ homeScore: 0, awayScore: 0, bestOf: 1, scoreLimit: 1, mapScores: [] as { map: string, home: number, away: number }[] });
    const [scoreForm, setScoreForm] = useState({ kills: 0, placement: 0, points: 0 });

    // Queries
    const { data: tournamentsData } = useQuery({
        queryKey: ['tournaments'],
        queryFn: async () => {
            const res = await fetch('/api/tournaments');
            return res.json();
        }
    });

    const tournament = useMemo(() => 
        tournamentsData?.tournaments?.find((t: any) => t.id === tournamentId),
        [tournamentsData, tournamentId]
    );

    const { data: teams = [], isLoading: teamsLoading } = useQuery({
        queryKey: ['teams', tournamentId],
        queryFn: async () => {
            const res = await fetch(`/api/tournaments/${tournamentId}/teams`);
            return res.json();
        }
    });

    const { data: matches = [], isLoading: matchesLoading } = useQuery({
        queryKey: ['matches', tournamentId],
        queryFn: async () => {
            const res = await fetch(`/api/tournaments/${tournamentId}/matches`);
            const data = await res.json();
            return Array.isArray(data) ? data : [];
        }
    });

    const { data: scoreboard = [], isLoading: scoreboardLoading } = useQuery({
        queryKey: ['scoreboard', tournamentId],
        queryFn: async () => {
            if (tournament?.category !== 'BATTLE_ROYALE') return [];
            const res = await fetch(`/api/tournaments/${tournamentId}/scoreboard`);
            return res.json();
        },
        enabled: !!tournament && tournament.category === 'BATTLE_ROYALE'
    });

    const loading = teamsLoading || matchesLoading || (tournament?.category === 'BATTLE_ROYALE' && scoreboardLoading);

    // Live SSE match updates
    useMatchStream(tournamentId, (data) => {
        queryClient.setQueryData(['matches', tournamentId], (prev: any[] | undefined) =>
            prev?.map((m) => (m.id === data.matchId ? data.match : m))
        );
    });

    // Mutations
    const addTeamMutation = useMutation({
        mutationFn: async (payload: any) => {
            const res = await fetch(`/api/tournaments/${tournamentId}/teams`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error('Failed to add team');
            return res.json();
        },
        onSuccess: () => {
            setNewTeam({ name: '', logoUrl: '', seed: '', players: Array(10).fill({ name: '', seating: '', steamId: '' }) });
            queryClient.invalidateQueries({ queryKey: ['teams', tournamentId] });
        }
    });

    const editTeamMutation = useMutation({
        mutationFn: async ({ id, ...payload }: any) => {
            const res = await fetch(`/api/teams/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error('Failed to edit team');
            return res.json();
        },
        onSuccess: () => {
            setEditingTeam(null);
            queryClient.invalidateQueries({ queryKey: ['teams', tournamentId] });
        }
    });

    const deleteTeamMutation = useMutation({
        mutationFn: async (teamId: string) => {
            const res = await fetch(`/api/teams/${teamId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete team');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['teams', tournamentId] });
        }
    });

    const updateSeedsMutation = useMutation({
        mutationFn: async (newTeams: any[]) => {
            await Promise.all(newTeams.map((team, index) => 
                fetch(`/api/teams/${team.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ seed: index + 1 }),
                })
            ));
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['teams', tournamentId] });
        }
    });

    const generateMatchesMutation = useMutation({
        mutationFn: async () => {
            setGenerating(true);
            try {
                const res = await fetch(`/api/tournaments/${tournamentId}/generate`, { method: 'POST' });
                if (!res.ok) {
                    const error = await res.json();
                    throw new Error(error.error || 'Failed to generate matches');
                }
                return res.json();
            } finally {
                setGenerating(false);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] });
        }
    });

    const saveMatchMutation = useMutation({
        mutationFn: async ({ id, ...payload }: any) => {
            const res = await fetch(`/api/matches/${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error('Failed to save match');
            return res.json();
        },
        onSuccess: () => {
            setEditingMatch(null);
            queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] });
        }
    });

    const saveScoreboardMutation = useMutation({
        mutationFn: async (payload: any) => {
            const res = await fetch(`/api/tournaments/${tournamentId}/scoreboard`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error('Failed to save scoreboard');
            return res.json();
        },
        onSuccess: () => {
            setEditingScoreboard(null);
            queryClient.invalidateQueries({ queryKey: ['scoreboard', tournamentId] });
        }
    });

    const addTeam = (e: React.FormEvent) => {
        e.preventDefault();
        const cleanedPlayers = newTeam.players.slice(0, tournament?.teamSize || 5).filter(p => p.name.trim() !== '');
        addTeamMutation.mutate({ ...newTeam, players: cleanedPlayers });
    };

    const editTeam = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingTeam) {
            editTeamMutation.mutate({ id: editingTeam.id, name: editingTeam.name, seed: Number(editingTeam.seed) });
        }
    };

    const deleteTeam = (teamId: string) => {
        if (confirm('Are you sure you want to remove this team?')) {
            deleteTeamMutation.mutate(teamId);
        }
    };

    const onDragEnd = () => {
        if (draggedItemIndex !== null) {
            updateSeedsMutation.mutate(teams);
        }
        setDraggedItemIndex(null);
    };

    const generateMatches = () => {
        if (!tournament || teams.length < 2) return;
        generateMatchesMutation.mutate();
    };

    const saveMatch = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingMatch) {
            saveMatchMutation.mutate({ id: editingMatch.id, ...matchForm });
        }
    };

    const onDragStart = (e: React.DragEvent, index: number) => {
        setDraggedItemIndex(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const onDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedItemIndex === null || draggedItemIndex === index) return;

        const items = [...teams];
        const draggedItem = items[draggedItemIndex];
        items.splice(draggedItemIndex, 1);
        items.splice(index, 0, draggedItem);
        
        setDraggedItemIndex(index);
        queryClient.setQueryData(['teams', tournamentId], items);
    };

    const sortedTeams = useMemo(() => {
        return [...teams].sort((a, b) => (Number(a.seed) || 999) - (Number(b.seed) || 999));
    }, [teams]);

    const openMatchModal = (match: any) => {
        setEditingMatch(match);
        let parsed = [];
        try { parsed = typeof match.mapScores === 'string' ? JSON.parse(match.mapScores) : (match.mapScores || []); } catch (e) { }
        while (parsed.length < match.bestOf) parsed.push({ map: '', home: 0, away: 0 });
        setMatchForm({
            homeScore: match.homeScore,
            awayScore: match.awayScore,
            bestOf: match.bestOf,
            scoreLimit: match.scoreLimit,
            mapScores: parsed.slice(0, match.bestOf)
        });
    };

    const updateMapScore = (index: number, team: 'map' | 'home' | 'away', val: any) => {
        const updatedMaps = [...matchForm.mapScores];
        updatedMaps[index] = { ...updatedMaps[index], [team]: val };

        let hScore = 0;
        let aScore = 0;
        updatedMaps.forEach(m => {
            if (m.home > m.away) hScore++;
            else if (m.away > m.home) aScore++;
        });

        setMatchForm({ ...matchForm, mapScores: updatedMaps, homeScore: hScore, awayScore: aScore });
    };

    const saveScoreboard = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingScoreboard) {
            saveScoreboardMutation.mutate({
                teamId: editingScoreboard.teamId || editingScoreboard.id,
                ...scoreForm
            });
        }
    };

    if (loading && !tournament) return <div className="min-h-screen bg-[#0d0f12] flex items-center justify-center text-gray-500 font-black tracking-[0.2em] uppercase animate-pulse">Loading System...</div>;
    if (!tournament) return (
        <div className="min-h-screen bg-[#0d0f12] flex flex-col items-center justify-center text-white text-center p-10">
            <ShieldAlert size={64} className="text-red-500 mb-8 opacity-20" />
            <h2 className="text-3xl font-extrabold uppercase tracking-tighter mb-4">ENTITY NOT FOUND</h2>
            <p className="text-gray-500 font-bold uppercase tracking-widest text-xs mb-10">The tournament identifier provided does not exist in our registries.</p>
            <Link href="/dashboard" className="bg-white/5 hover:bg-white/10 px-8 py-4 rounded-2xl border border-white/5 font-black uppercase tracking-widest text-[10px] transition-all">
                Return to Command Center
            </Link>
        </div>
    );

    const gameMeta = getGameMetadata(tournament.game);

    return (
        <div className="flex h-screen bg-[#0d0f12] text-white overflow-hidden font-sans">
            {/* MOBILE NAVIGATION DRAWER */}
            {/* MOBILE NAVIGATION DRAWER */}
            {isMenuOpen && (
                <div className="fixed inset-0 z-[200] md:hidden">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)}></div>
                    <div className="absolute top-0 left-0 bottom-0 w-80 bg-[#16191d] p-8 flex flex-col gap-8 shadow-2xl border-r border-white/5">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center">
                                    <Trophy size={24} className="text-white" />
                                </div>
                                <span className="font-black uppercase tracking-tighter text-2xl group-hover:text-blue-500 transition-colors">ApexPlay</span>
                            </div>
                            <button onClick={() => setIsMenuOpen(false)} className="p-3 hover:bg-white/5 rounded-2xl transition-all">
                                <X size={24} className="text-gray-400" />
                            </button>
                        </div>
                        
                        <nav className="flex flex-col gap-3">
                            <Link 
                                href="/dashboard" 
                                className="flex items-center gap-4 p-5 rounded-2xl bg-white/5 border border-white/5 font-bold uppercase tracking-widest text-[11px] text-gray-400 hover:text-white transition-all mb-4"
                            >
                                <ArrowLeft size={18} /> Back to Dashboard
                            </Link>
                            
                            {[
                                { id: "overview", icon: Trophy, label: "Overview" },
                                { id: "participants", icon: Users, label: "Participants" },
                                { id: tournament?.category === 'BATTLE_ROYALE' ? "scoreboard" : "matches", icon: Gamepad2, label: tournament?.category === 'BATTLE_ROYALE' ? "Scoreboard" : "Matches" },
                                { id: "settings", icon: Settings2, label: "Settings" },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => {
                                        setActiveTab(tab.id);
                                        setIsMenuOpen(false);
                                    }}
                                    className={`flex items-center gap-4 p-5 rounded-2xl transition-all border ${activeTab === tab.id ? 'bg-blue-600/10 text-blue-500 border-blue-500/20' : 'text-gray-500 border-transparent hover:bg-white/5'}`}
                                >
                                    <tab.icon size={22} />
                                    <span className="font-black uppercase tracking-widest text-[11px]">{tab.label}</span>
                                </button>
                            ))}
                        </nav>
                        
                        <div className="mt-auto space-y-4">
                            <Link 
                                href={`/tournaments/${tournamentId}`} 
                                target="_blank"
                                onClick={() => setIsMenuOpen(false)}
                                className="flex items-center gap-4 p-6 rounded-2xl text-gray-400 hover:text-white hover:bg-white/5 transition-all border border-transparent font-bold uppercase tracking-widest text-[11px]"
                            >
                                <ExternalLink size={22} />
                                <span>Public View</span>
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {/* LEFT SIDEBAR (EXPANDABLE - DESKTOP ONLY) */}
            <aside className="hidden md:flex w-64 bg-[#16191d] border-r border-white/5 flex flex-col py-8 gap-8 shrink-0 overflow-y-auto custom-scrollbar">
                <div className="px-6 mb-4">
                    <Link href="/dashboard" className="flex items-center gap-4 group transition-all">
                        <div className="w-12 h-12 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl flex items-center justify-center transition-all">
                            <ArrowLeft size={20} className="text-gray-400 group-hover:text-white" />
                        </div>
                        <span className="font-bold text-gray-400 group-hover:text-white uppercase tracking-widest text-[11px]">Dashboard</span>
                    </Link>
                </div>
                
                <nav className="flex flex-col gap-2 px-3">
                    <div className="px-4 text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-4">Management</div>
                    {[
                        { id: "overview", icon: Trophy, label: "Overview" },
                        { id: "participants", icon: Users, label: "Participants" },
                        { id: tournament?.category === 'BATTLE_ROYALE' ? "scoreboard" : "matches", icon: Gamepad2, label: tournament?.category === 'BATTLE_ROYALE' ? "Scoreboard" : "Matches" },
                        { id: "settings", icon: Settings2, label: "Settings" },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all group relative font-bold uppercase tracking-widest text-[11px] ${activeTab === tab.id ? 'bg-blue-600/10 text-blue-500 border border-blue-500/20' : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'}`}
                        >
                            <tab.icon size={20} strokeWidth={2.5} className={activeTab === tab.id ? 'text-blue-500' : 'group-hover:text-blue-500 transition-colors'} />
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </nav>

                <div className="mt-auto flex flex-col gap-2 px-3 pt-8 border-t border-white/5">
                    <Link 
                        href={`/tournaments/${tournamentId}`} 
                        target="_blank" 
                        className="flex items-center gap-4 px-4 py-3.5 rounded-2xl text-gray-400 hover:text-blue-500 hover:bg-blue-500/5 transition-all font-bold uppercase tracking-widest text-[11px] group border border-transparent"
                    >
                        <ExternalLink size={20} className="group-hover:translate-x-0.5 transition-transform" />
                        <span>Public View</span>
                    </Link>
                </div>
            </aside>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 flex flex-col overflow-hidden relative">
                {/* HEADER BAR */}
                <header className="relative w-full overflow-hidden shrink-0 border-b border-white/10 h-40 md:h-56">
                  {/* Game Banner Background */}
                  <div className="absolute inset-0 z-0">
                    <Image 
                      src={gameMeta?.bannerUrl || ''} 
                      fill
                      className="object-cover grayscale-[0.2] brightness-[0.3]" 
                      alt=""
                      priority
                      sizes="100vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#0d0f12] via-[#0d0f12]/40 to-transparent"></div>
                    <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#0d0f12] to-transparent"></div>
                  </div>

                  <div className="max-w-[1600px] mx-auto h-full px-6 md:px-12 relative z-10 flex items-center justify-between gap-8">
                    <div className="flex items-center gap-8 md:gap-12">
                      <button 
                        onClick={() => setIsMenuOpen(true)}
                        className="md:hidden p-3 hover:bg-white/5 rounded-2xl transition-all text-gray-400 shrink-0"
                      >
                        <Menu size={28} />
                      </button>
                      
                      {/* Game Logo Badge - Hidden on small mobile */}
                      <div className="hidden sm:flex w-24 h-24 md:w-32 md:h-32 bg-white/5 backdrop-blur-3xl rounded-3xl border border-white/10 items-center justify-center p-5 relative shrink-0 shadow-2xl">
                        <Image 
                            src={gameMeta?.logoUrl || ''} 
                            width={80} 
                            height={80} 
                            className="object-contain drop-shadow-[0_0_20px_rgba(37,99,235,0.4)]" 
                            alt={tournament.game} 
                            sizes="80px"
                        />
                      </div>

                      <div className="space-y-3 md:space-y-4 truncate">
                        <div className="flex items-center gap-4 overflow-hidden">
                          <span className="bg-blue-600/20 text-blue-400 text-[10px] md:text-[11px] font-black uppercase tracking-[0.3em] px-4 py-1.5 rounded-full border border-blue-500/20 whitespace-nowrap backdrop-blur-md">
                            {tournament.game} / {tournament.category}
                          </span>
                          <span className="hidden sm:inline bg-white/5 text-gray-400 text-[11px] font-black uppercase tracking-[0.3em] px-4 py-1.5 rounded-full border border-white/10 whitespace-nowrap backdrop-blur-md">
                            Management Command
                          </span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl md:text-5xl font-black uppercase tracking-tighter leading-none drop-shadow-2xl truncate">
                          {tournament.name}
                        </h1>
                        <div className="flex items-center gap-6 md:gap-10 text-[10px] md:text-[11px] font-black text-gray-300 uppercase tracking-[0.3em]">
                          <div className="flex items-center gap-3">
                            <Users size={18} className="text-blue-500" />
                            <span>{teams.length} Teams Registered</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Sword size={18} className="text-blue-500" />
                            <span>{matches.length} Brackets Matches</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="hidden lg:flex items-center gap-6">
                        <Link href={`/bracket/${tournament.id}/roster`} target="_blank" className="bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white h-14 px-8 rounded-2xl font-black text-[11px] tracking-widest transition-all border border-white/10 active:scale-95 flex items-center gap-4 uppercase shadow-xl">
                            <Users size={20} /> Roster Overlay
                        </Link>
                        <Link href={`/bracket/${tournament.id}/overlay`} target="_blank" className="bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white h-14 px-10 rounded-2xl font-black text-[11px] tracking-widest transition-all border border-blue-500/30 active:scale-95 flex items-center gap-4 uppercase shadow-xl shadow-blue-600/20">
                            <Gamepad2 size={20} /> Broadcast Overlay
                        </Link>
                    </div>
                  </div>
                </header>

                {/* SCROLLABLE CONTENT */}
                <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
                    <div className="max-w-[1600px] mx-auto space-y-12 pb-24">
                        
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
                            {/* SHARED: Participant Management */}
                            {activeTab === 'participants' || activeTab === 'overview' ? (
                                <div className="lg:col-span-4 space-y-10 focus-within:z-40">
                                    {/* REGISTRATION LINK */}
                                    <section className="bg-blue-600/5 border border-blue-500/10 rounded-[2.5rem] p-8 relative overflow-hidden group hover:border-blue-500/30 transition-all">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 blur-[40px] rounded-full -mr-16 -mt-16 group-hover:bg-blue-600/10 transition-all duration-700"></div>
                                        <div className="relative z-10 space-y-6">
                                            <div className="flex items-center justify-between">
                                                <h2 className="text-[10px] font-black tracking-[0.2em] uppercase flex items-center gap-3 text-blue-500">
                                                    <Share2 size={14} />
                                                    External Registration
                                                </h2>
                                                <button 
                                                    onClick={() => {
                                                        const url = `${window.location.host === 'localhost:3000' ? 'http://localhost:3000' : window.location.origin}/tournaments/${tournamentId}/register`;
                                                        navigator.clipboard.writeText(url);
                                                        alert('Link copied to clipboard!');
                                                    }}
                                                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-black uppercase text-[9px] tracking-widest transition-all shadow-lg shadow-blue-600/20 active:scale-95 flex items-center gap-2"
                                                >
                                                    <Copy size={12} /> COPY LINK
                                                </button>
                                            </div>
                                            <div className="bg-black/40 border border-white/5 rounded-2xl px-6 py-4 text-blue-400/80 font-mono text-[10px] truncate">
                                                {typeof window !== 'undefined' ? `${window.location.origin}/tournaments/${tournamentId}/register` : `/tournaments/${tournamentId}/register`}
                                            </div>
                                        </div>
                                    </section>

                                    {/* ADD PARTICIPANT */}
                                    <section className="bg-[#16191d] border border-white/5 p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden group hover:border-white/10 transition-all">
                                        <h2 className="text-xl font-extrabold uppercase tracking-tighter mb-10 flex items-center gap-3">
                                            <UserPlus size={24} className="text-blue-500" />
                                            Enroll Competitor
                                        </h2>
                                        <form onSubmit={addTeam} className="space-y-8 relative z-10">
                                            <div className="space-y-2">
                                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest">Team Identity</label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={newTeam.name}
                                                    onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                                                    className="w-full bg-black border border-white/5 rounded-2xl px-6 py-5 text-white focus:outline-none focus:border-blue-500 transition-all font-bold placeholder:text-white/5"
                                                    placeholder="e.g. NAVI"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest">Initial Ranking / Seed</label>
                                                <input
                                                    type="number"
                                                    value={newTeam.seed}
                                                    onChange={(e) => setNewTeam({ ...newTeam, seed: e.target.value })}
                                                    className="w-full bg-black border border-white/5 rounded-2xl px-6 py-5 text-white focus:outline-none focus:border-blue-500 transition-all font-bold placeholder:text-white/5"
                                                    placeholder="1"
                                                />
                                            </div>
                                            <button
                                                type="submit"
                                                className="w-full bg-blue-600 hover:bg-blue-500 py-6 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-600/20 active:scale-95 text-[10px] text-white"
                                            >
                                                Inject into Roster
                                            </button>
                                        </form>
                                    </section>

                                    {/* PARTIPANTS LIST */}
                                    <section className="bg-[#16191d] border border-white/5 p-10 rounded-[2.5rem] shadow-2xl">
                                        <div className="flex items-center justify-between mb-10">
                                            <h2 className="text-xl font-extrabold uppercase tracking-tighter flex items-center gap-3">
                                                <Users size={24} className="text-blue-500" />
                                                Active Roster
                                            </h2>
                                            <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">{teams.length} Units</span>
                                        </div>
                                        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                                            {sortedTeams.map((team: any, index: number) => (
                                                <div 
                                                    key={team.id} 
                                                    draggable
                                                    onDragStart={(e) => onDragStart(e, index)}
                                                    onDragOver={(e) => onDragOver(e, index)}
                                                    onDragEnd={onDragEnd}
                                                    className={`bg-black/40 border border-white/5 rounded-2xl px-6 py-5 flex items-center justify-between group hover:border-blue-500/30 transition-all cursor-grab active:cursor-grabbing ${draggedItemIndex === index ? 'opacity-20 scale-95 border-blue-500' : ''}`}
                                                >
                                                    <div className="flex items-center gap-4 pointer-events-none">
                                                        <div className="flex flex-col items-center justify-center bg-white/5 w-10 h-10 rounded-xl border border-white/5">
                                                            <span className="text-[10px] font-black text-blue-500">#{index + 1}</span>
                                                        </div>
                                                        <div>
                                                            <span className="font-extrabold uppercase tracking-tight block group-hover:text-blue-500 transition-colors">{team.name}</span>
                                                            <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest mt-1 block">
                                                                {team.players?.length || 0} Registered Players
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setEditingTeam({ ...team });
                                                            }}
                                                            className="text-gray-500 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-xl"
                                                        >
                                                            <Settings2 size={16} />
                                                        </button>
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                deleteTeam(team.id);
                                                            }}
                                                            className="text-gray-800 hover:text-red-500 transition-colors p-2 hover:bg-red-500/10 rounded-xl"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            {teams.length === 0 && (
                                                <div className="py-20 text-center text-white/5 border-2 border-dashed border-white/5 rounded-[2rem] font-black uppercase tracking-widest text-[10px]">
                                                    Registries Empty
                                                </div>
                                            )}
                                        </div>
                                    </section>
                                </div>
                            ) : null}

                            {/* RIGHT: Main Match/Scoreboard Command */}
                            <div className={`${activeTab === 'participants' ? 'lg:col-span-8' : activeTab === 'overview' ? 'lg:col-span-8' : 'lg:col-span-12'} space-y-10`}>
                                {/* TAB: OVERVIEW / MATCHES (Bracket format) */}
                                {tournament.category === 'BRACKET' && (activeTab === 'matches' || activeTab === 'overview') && (
                                    <>
                                        <div className="flex justify-between items-center mb-4">
                                            <h2 className="text-2xl font-extrabold uppercase tracking-tighter flex items-center gap-4">
                                                <Sword size={32} className="text-red-500" />
                                                Match Command
                                            </h2>
                                            <button
                                                onClick={generateMatches}
                                                disabled={generating || teams.length < 2}
                                                className="bg-blue-600 hover:bg-blue-500 text-white h-14 px-10 rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-600/20 active:scale-95 disabled:opacity-30 text-[10px] flex items-center gap-3"
                                            >
                                                {generating ? <Circle size={16} className="animate-pulse fill-white" /> : <Send size={16} />}
                                                {generating ? 'Processing Engine...' : (matches.length > 0 ? 'Regenerate Bracket' : 'Initialize All Matches')}
                                            </button>
                                        </div>

                                        {matches.length > 0 ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
                                                {matches.map((match: any) => (
                                                    <div
                                                        key={match.id}
                                                        className="bg-[#16191d] border border-white/5 p-10 rounded-[2.5rem] shadow-xl hover:border-blue-500/30 transition-all cursor-pointer group relative overflow-hidden"
                                                        onClick={() => openMatchModal(match)}
                                                    >
                                                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/0 blur-[60px] rounded-full -mr-16 -mt-16 group-hover:bg-blue-500/5 transition-all duration-700"></div>
                                                        
                                                        <div className="flex justify-between items-start mb-10 relative z-10">
                                                            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-full border border-white/5 group-hover:bg-blue-500/10 group-hover:text-blue-500 hover:border-blue-500/20 transition-all">
                                                                Round {match.round} • Case {match.matchOrder + 1}
                                                            </span>
                                                            <div className="flex items-center gap-2">
                                                                {match.status === 'COMPLETED' ? (
                                                                    <span className="text-[9px] font-black text-green-500 bg-green-500/10 px-3 py-1.5 rounded-full uppercase tracking-widest border border-green-500/20 flex items-center gap-1.5">
                                                                        <Check size={12} /> VERIFIED
                                                                    </span>
                                                                ) : match.status === 'LIVE' ? (
                                                                    <span className="text-[9px] font-black text-red-500 bg-red-500/10 px-3 py-1.5 rounded-full uppercase tracking-widest border border-red-500/20 flex items-center gap-1.5 animate-pulse">
                                                                        <Circle size={8} className="fill-red-500" /> LIVE STREAM
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[9px] font-black text-gray-600 bg-white/5 px-4 py-1.5 rounded-full uppercase tracking-widest border border-white/5">
                                                                        PENDING
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="space-y-4 relative z-10">
                                                            <div className="flex justify-between items-center bg-black/40 px-8 py-7 rounded-[1.5rem] border border-white/5 group-hover:border-blue-500/20 transition-all">
                                                                <span className={`text-xl font-extrabold uppercase tracking-tighter truncate ${match.winnerId === match.homeTeamId ? 'text-blue-500' : 'text-white'}`}>
                                                                    {match.homeTeam?.name || 'TBD'}
                                                                </span>
                                                                <span className={`font-mono text-3xl font-black ${match.homeScore > match.awayScore ? 'text-blue-500' : 'text-gray-700 opacity-50'}`}>{match.homeScore}</span>
                                                            </div>
                                                            <div className="flex justify-between items-center bg-black/40 px-8 py-7 rounded-[1.5rem] border border-white/5 group-hover:border-blue-500/20 transition-all">
                                                                <span className={`text-xl font-extrabold uppercase tracking-tighter truncate ${match.winnerId === match.awayTeamId ? 'text-blue-500' : 'text-white'}`}>
                                                                    {match.awayTeam?.name || 'TBD'}
                                                                </span>
                                                                <span className={`font-mono text-3xl font-black ${match.awayScore > match.homeScore ? 'text-blue-500' : 'text-gray-700 opacity-50'}`}>{match.awayScore}</span>
                                                            </div>
                                                        </div>

                                                        <div className="mt-10 pt-8 border-t border-white/5 flex items-center justify-between opacity-50 group-hover:opacity-100 transition-all">
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em]">
                                                                    BO{match.bestOf}
                                                                </span>
                                                                <span className="w-1 h-1 bg-white/10 rounded-full"></span>
                                                                <span className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em]">
                                                                    LIMIT {match.scoreLimit}
                                                                </span>
                                                            </div>
                                                            <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2 group-hover:translate-x-1 transition-transform">
                                                                Interface Controls <ArrowLeft size={12} className="rotate-180" />
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="py-40 text-center border-2 border-dashed border-white/5 rounded-[4rem] bg-white/[0.02]">
                                                <ShieldAlert size={64} className="mx-auto text-white/5 mb-8" />
                                                <h3 className="text-xl font-extrabold uppercase tracking-tighter text-gray-600 mb-2">Theater Inactive</h3>
                                                <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest max-w-[240px] mx-auto leading-relaxed">System requires enrolled participants to generate competitive bracket data.</p>
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* TAB: SCOREBOARD (Battle Royale format) */}
                                {tournament.category === 'BATTLE_ROYALE' && (activeTab === 'scoreboard' || activeTab === 'overview') && (
                                    <section className="space-y-10">
                                        <div className="flex justify-between items-center mb-4">
                                            <h2 className="text-2xl font-extrabold uppercase tracking-tighter flex items-center gap-4">
                                                <Trophy size={32} className="text-blue-500" />
                                                Scoreboard Command
                                            </h2>
                                        </div>

                                        <div className="bg-[#16191d] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-black/40 border-b border-white/5">
                                                        <th className="px-10 py-6 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Rank</th>
                                                        <th className="px-10 py-6 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Competitor</th>
                                                        <th className="px-10 py-6 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Total Score</th>
                                                        <th className="px-10 py-6 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] text-right">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {teams.map((team: any, idx: number) => (
                                                        <tr key={team.id} className="group hover:bg-white/[0.02] transition-all">
                                                            <td className="px-10 py-8">
                                                                <span className="font-mono text-2xl font-black text-gray-700 opacity-50 group-hover:text-blue-500 group-hover:opacity-100 transition-all">
                                                                    {idx + 1}
                                                                </span>
                                                            </td>
                                                            <td className="px-10 py-8">
                                                                <span className="text-lg font-extrabold uppercase tracking-tight">{team.name}</span>
                                                            </td>
                                                            <td className="px-10 py-8">
                                                                <span className="text-2xl font-black text-blue-500">
                                                                    {scoreboard.find((s: any) => s.teamId === team.id)?.points || 0}
                                                                </span>
                                                                <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest ml-3">PTS</span>
                                                            </td>
                                                            <td className="px-10 py-8 text-right">
                                                                <button 
                                                                    onClick={() => {
                                                                        const existing = scoreboard.find((s: any) => s.teamId === team.id);
                                                                        setEditingScoreboard(existing || { teamId: team.id, team });
                                                                        setScoreForm({
                                                                            kills: existing?.kills || 0,
                                                                            placement: existing?.placement || 0,
                                                                            points: existing?.points || 0
                                                                        });
                                                                    }}
                                                                    className="bg-white/5 hover:bg-blue-600 text-gray-500 hover:text-white px-6 py-3 rounded-xl font-black uppercase text-[9px] tracking-widest transition-all"
                                                                >
                                                                    Update Log
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {teams.length === 0 && (
                                                        <tr>
                                                            <td colSpan={4} className="py-20 text-center text-white/5 font-black uppercase tracking-widest text-[10px]">
                                                                No entries detected
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </section>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* TEAM EDIT MODAL */}
                {editingTeam && (
                    <div className="fixed inset-0 bg-[#0d0f12]/98 backdrop-blur-2xl flex items-center justify-center z-[110] p-6 overflow-hidden">
                        <div className="bg-[#16191d] border border-white/5 w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden relative">
                            <header className="px-10 py-8 border-b border-white/5 flex justify-between items-center bg-[#16191d]/50 backdrop-blur-md">
                                <div>
                                    <h2 className="text-xl font-extrabold uppercase tracking-tighter">Edit Competitor</h2>
                                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mt-1">Refine Identity & Ranking</p>
                                </div>
                                <button onClick={() => setEditingTeam(null)} className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/5 group">
                                    <X size={18} className="group-hover:rotate-90 transition-transform duration-300" />
                                </button>
                            </header>

                            <form onSubmit={editTeam} className="p-10 space-y-8">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest pl-2">Team Name</label>
                                    <input
                                        autoFocus
                                        type="text"
                                        value={editingTeam.name}
                                        onChange={(e) => setEditingTeam({ ...editingTeam, name: e.target.value })}
                                        className="w-full bg-black border border-white/5 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-blue-500 transition-all font-bold"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest pl-2">Assigned Seed</label>
                                    <input
                                        type="number"
                                        value={editingTeam.seed}
                                        onChange={(e) => setEditingTeam({ ...editingTeam, seed: e.target.value })}
                                        className="w-full bg-black border border-white/5 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-blue-500 transition-all font-bold"
                                    />
                                </div>
                                <div className="flex gap-4 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setEditingTeam(null)}
                                        className="flex-1 bg-white/5 hover:bg-white/10 py-4 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all border border-white/5 active:scale-95"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-[2] bg-blue-600 hover:bg-blue-500 py-4 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all shadow-xl shadow-blue-600/20 active:scale-95 text-white"
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* SCOREBOARD UPDATE MODAL */}
                {editingScoreboard && (
                    <div className="fixed inset-0 bg-[#0d0f12]/98 backdrop-blur-2xl flex items-center justify-center z-[100] p-6 overflow-hidden">
                        <div className="bg-[#16191d] border border-white/5 w-full max-w-xl rounded-[3rem] shadow-[0_0_100px_rgba(37,99,235,0.15)] overflow-hidden relative">
                            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/5 blur-[120px] rounded-full -mr-64 -mt-64 pointer-events-none"></div>
                            
                            <header className="px-12 py-10 border-b border-white/5 flex justify-between items-center relative z-10 bg-[#16191d]/50 backdrop-blur-md">
                                <div>
                                    <h2 className="text-2xl font-extrabold uppercase tracking-tighter">Score Update Log</h2>
                                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mt-1">Manual Points Allocation • {editingScoreboard.team?.name || editingScoreboard.name}</p>
                                </div>
                                <button onClick={() => setEditingScoreboard(null)} className="w-12 h-12 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/5 group">
                                    <X size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                                </button>
                            </header>

                            <form onSubmit={saveScoreboard} className="p-12 space-y-10 relative z-10">
                                <div className="grid grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2">Total Kills</label>
                                        <input
                                            type="number"
                                            value={scoreForm.kills}
                                            onChange={(e) => {
                                                const kills = parseInt(e.target.value) || 0;
                                                setScoreForm({ ...scoreForm, kills, points: kills + (scoreForm.placement === 1 ? 15 : scoreForm.placement <= 5 ? 10 : scoreForm.placement <= 10 ? 5 : 0) });
                                            }}
                                            className="w-full bg-black border border-white/5 rounded-2xl px-6 py-5 text-2xl font-black text-white focus:outline-none focus:border-blue-500 transition-all text-center"
                                        />
                                    </div>
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2">Match Placement</label>
                                        <input
                                            type="number"
                                            value={scoreForm.placement}
                                            onChange={(e) => {
                                                const placement = parseInt(e.target.value) || 0;
                                                setScoreForm({ ...scoreForm, placement, points: scoreForm.kills + (placement === 1 ? 15 : placement <= 5 ? 10 : placement <= 10 ? 5 : 0) });
                                            }}
                                            className="w-full bg-black border border-white/5 rounded-2xl px-6 py-5 text-2xl font-black text-white focus:outline-none focus:border-red-500 transition-all text-center"
                                        />
                                    </div>
                                </div>

                                <div className="bg-blue-600/5 border border-blue-500/10 rounded-3xl p-10 text-center">
                                    <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] block mb-2">Calculated Yield</span>
                                    <div className="flex items-baseline justify-center gap-3">
                                        <span className="text-7xl font-black text-white">{scoreForm.points}</span>
                                        <span className="text-xl font-black text-blue-500/50 uppercase tracking-widest">Points</span>
                                    </div>
                                    <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest mt-6">Automatic calculation based on kill count and placement tier.</p>
                                    <button
                                        type="submit"
                                        className="w-full bg-blue-600 hover:bg-blue-500 py-6 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all shadow-[0_20px_40px_rgba(37,99,235,0.3)] mt-12 text-white"
                                    >
                                        Update Registries
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}


                {/* MATCH EDIT MODAL */}
                {editingMatch && (
                    <div className="fixed inset-0 bg-[#0d0f12]/98 backdrop-blur-2xl flex items-center justify-center z-[100] p-6 overflow-hidden">
                        <div className="bg-[#16191d] border border-white/5 w-full max-w-2xl rounded-[3rem] shadow-[0_0_100px_rgba(239,68,68,0.1)] overflow-hidden relative">
                            {/* Accent decoration */}
                            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-red-600/5 blur-[120px] rounded-full -mr-64 -mt-64 pointer-events-none"></div>

                            <header className="px-12 py-10 border-b border-white/5 flex justify-between items-center relative z-10 bg-[#16191d]/50 backdrop-blur-md">
                                <div>
                                    <h2 className="text-2xl font-extrabold uppercase tracking-tighter">Match Resolution Unit</h2>
                                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mt-1">Round {editingMatch.round} • {editingMatch.homeTeam?.name || 'TBD'} vs {editingMatch.awayTeam?.name || 'TBD'}</p>
                                </div>
                                <button onClick={() => setEditingMatch(null)} className="w-12 h-12 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/5 group">
                                    <X size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                                </button>
                            </header>

                            <form onSubmit={saveMatch} className="p-12 space-y-10 relative z-10 max-h-[70vh] overflow-y-auto custom-scrollbar">
                                <section className="grid grid-cols-2 gap-10">
                                    <div className="space-y-4">
                                        <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-1">{editingMatch.homeTeam?.name || 'HOME'}</span>
                                        <input
                                            type="number"
                                            value={matchForm.homeScore}
                                            onChange={(e) => setMatchForm({ ...matchForm, homeScore: parseInt(e.target.value) || 0 })}
                                            className="w-full bg-black border border-white/5 rounded-3xl px-8 py-6 text-4xl font-black text-white focus:outline-none focus:border-blue-500 transition-all text-center"
                                        />
                                    </div>
                                    <div className="space-y-4">
                                        <span className="text-[10px] font-black text-red-500 uppercase tracking-widest ml-1">{editingMatch.awayTeam?.name || 'AWAY'}</span>
                                        <input
                                            type="number"
                                            value={matchForm.awayScore}
                                            onChange={(e) => setMatchForm({ ...matchForm, awayScore: parseInt(e.target.value) || 0 })}
                                            className="w-full bg-black border border-white/5 rounded-3xl px-8 py-6 text-4xl font-black text-white focus:outline-none focus:border-red-500 transition-all text-center"
                                        />
                                    </div>
                                </section>

                                {matchForm.bestOf > 1 && (
                                    <section className="space-y-6">
                                        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4">Detailed Map Logs</h3>
                                        <div className="space-y-4">
                                            {matchForm.mapScores.map((ms, idx) => (
                                                <div key={idx} className="flex gap-4 items-center bg-black/40 p-4 rounded-2xl border border-white/5">
                                                    <select 
                                                        value={ms.map}
                                                        onChange={(e) => updateMapScore(idx, 'map', e.target.value)}
                                                        className="flex-1 bg-black text-[10px] font-black uppercase tracking-widest border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500"
                                                    >
                                                        <option value="">Select Map</option>
                                                        {getMapPool(tournament.teamSize).map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                                                    </select>
                                                    <input 
                                                        type="number" 
                                                        value={ms.home}
                                                        onChange={(e) => updateMapScore(idx, 'home', parseInt(e.target.value) || 0)}
                                                        className="w-20 bg-black text-center font-black border border-white/10 rounded-xl py-3 focus:outline-none"
                                                        placeholder="H"
                                                    />
                                                    <span className="text-gray-700 font-black">VS</span>
                                                    <input 
                                                        type="number" 
                                                        value={ms.away}
                                                        onChange={(e) => updateMapScore(idx, 'away', parseInt(e.target.value) || 0)}
                                                        className="w-20 bg-black text-center font-black border border-white/10 rounded-xl py-3 focus:outline-none"
                                                        placeholder="A"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                )}

                                <div className="flex gap-4 pt-10">
                                    <button
                                        type="button"
                                        onClick={() => setEditingMatch(null)}
                                        className="flex-1 bg-white/5 hover:bg-white/10 py-6 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all border border-white/5"
                                    >
                                        Abort
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-[2] bg-blue-600 hover:bg-blue-500 py-6 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all shadow-[0_20px_40px_rgba(37,99,235,0.2)] text-white"
                                    >
                                        Broadcast Results
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

