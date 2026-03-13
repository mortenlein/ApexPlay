'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, UserPlus, Trophy, Trash2, Send, Sword, Check, X, ShieldAlert, Settings2, Users } from 'lucide-react';
import { getMapPool } from '@/lib/games';

export default function TournamentManage({ params }: { params: { id: string } }) {
    const [tournament, setTournament] = useState<any>(null);
    const [teams, setTeams] = useState<any[]>([]);
    const [matches, setMatches] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [newTeam, setNewTeam] = useState({ name: '', logoUrl: '', seed: '', players: Array(10).fill({ name: '', seating: '' }) });
    const [generating, setGenerating] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isTeamsExpanded, setIsTeamsExpanded] = useState(false);

    // Modal state
    const [editingMatch, setEditingMatch] = useState<any>(null);
    const [matchForm, setMatchForm] = useState({ homeScore: 0, awayScore: 0, bestOf: 1, scoreLimit: 1, mapScores: [] as { map: string, home: number, away: number }[] });
    const mapPool = useMemo(() => tournament ? getMapPool(tournament.teamSize) : [], [tournament]);

    useEffect(() => {
        fetchData();
    }, [params.id]);

    const fetchData = async () => {
        try {
            const tRes = await fetch(`/api/tournaments`);
            const allT = await tRes.json();
            const currentT = allT.find((t: any) => t.id === params.id);
            setTournament(currentT);

            const teamRes = await fetch(`/api/tournaments/${params.id}/teams`);
            const teamData = await teamRes.json();
            setTeams(teamData);

            const matchRes = await fetch(`/api/tournaments/${params.id}/matches`);
            const matchData = await matchRes.json();
            setMatches(Array.isArray(matchData) ? matchData : []);
        } catch (error) {
            console.error('Fetch error:', error);
        } finally {
            setLoading(false);
        }
    };

    const addTeam = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Filter empty player names and trim
            const cleanedPlayers = newTeam.players.slice(0, tournament?.teamSize || 5).filter(p => p.name.trim() !== '');

            const res = await fetch(`/api/tournaments/${params.id}/teams`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...newTeam, players: cleanedPlayers }),
            });
            if (res.ok) {
                setNewTeam({ name: '', logoUrl: '', seed: '', players: Array(10).fill({ name: '', seating: '' }) });
                fetchData();
            }
        } catch (error) {
            console.error('Add team error:', error);
        }
    };

    const generateMatches = async () => {
        if (!tournament || teams.length < 2) return;
        setGenerating(true);
        try {
            const res = await fetch(`/api/tournaments/${params.id}/generate`, {
                method: 'POST',
            });
            if (res.ok) {
                fetchData();
            } else {
                const error = await res.json();
                alert(`Error: ${error.error}`);
            }
        } catch (error) {
            console.error('Generate matches error:', error);
        } finally {
            setGenerating(false);
        }
    };

    const openMatchModal = (match: any) => {
        setEditingMatch(match);
        let parsed = [];
        try { parsed = typeof match.mapScores === 'string' ? JSON.parse(match.mapScores) : (match.mapScores || []); } catch (e) { }
        // Ensure the array matches bestOf length
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

        // Auto-tally series score (maps won) based on simple logic: Whoever has more rounds wins the map
        let hScore = 0;
        let aScore = 0;
        updatedMaps.forEach(m => {
            if (m.home > m.away) hScore++;
            else if (m.away > m.home) aScore++;
        });

        setMatchForm({ ...matchForm, mapScores: updatedMaps, homeScore: hScore, awayScore: aScore });
    };

    const saveMatch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingMatch) return;
        try {
            const res = await fetch(`/api/matches/${editingMatch.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(matchForm),
            });
            if (res.ok) {
                setEditingMatch(null);
                fetchData();
            }
        } catch (error) {
            console.error('Save match error:', error);
        }
    };

    if (loading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-gray-500 font-bold tracking-widest uppercase animate-pulse">Loading Details...</div>;
    if (!tournament) return <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center text-white"><p className="text-xl mb-4">Tournament not found</p><Link href="/dashboard" className="text-blue-500 underline">Back to Dashboard</Link></div>;

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white font-sans p-8">
            <div className="max-w-6xl mx-auto pb-24">
                <header className="mb-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4 md:gap-6">
                        <Link href="/dashboard" className="p-3 bg-white/5 hover:bg-white/10 border border-gray-800 rounded-xl transition-all">
                            <ArrowLeft size={20} />
                        </Link>
                        <div>
                            <h1 className="text-xl md:text-3xl font-black italic tracking-tighter uppercase line-clamp-1">{tournament.name}</h1>
                            <p className="text-blue-500 font-bold uppercase tracking-[0.2em] text-[8px] md:text-[10px] mt-1 drop-shadow-[0_0_5px_rgba(59,130,246,0.5)]">
                                {tournament.type.replace('_', ' ')}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                        <Link href={`/bracket/${tournament.id}/roster`} target="_blank" className="bg-blue-600 hover:bg-blue-700 hover:shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all px-4 md:px-8 py-3 md:py-4 rounded-xl font-black italic uppercase tracking-tighter flex items-center justify-center gap-2 text-xs md:text-base">
                            ROSTER OVERLAY
                        </Link>
                        <Link href={`/bracket/${tournament.id}/overlay`} target="_blank" className="bg-purple-600 hover:bg-purple-700 hover:shadow-[0_0_20px_rgba(147,51,234,0.3)] transition-all px-4 md:px-8 py-3 md:py-4 rounded-xl font-black italic uppercase tracking-tighter flex items-center justify-center gap-2 text-xs md:text-base">
                            BRACKET OVERLAY
                        </Link>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                    {/* LEFT: Participant Management */}
                    <div className="space-y-12">
                        <section className="bg-[#111111] border border-gray-800 p-8 rounded-3xl shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <UserPlus size={80} />
                            </div>
                            <h2 className="text-xl font-black italic tracking-tighter uppercase mb-6 flex items-center gap-2">
                                <UserPlus size={20} className="text-blue-500" />
                                Add Participant
                            </h2>
                            <form onSubmit={addTeam} className="space-y-6 relative z-10">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 mb-2 uppercase tracking-[0.2em]">Team Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={newTeam.name}
                                        onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                                        className="w-full bg-black border border-gray-800 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-blue-500 transition-all font-bold placeholder:text-gray-700"
                                        placeholder="LIQUID ENTHUSIASTS"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 mb-2 uppercase tracking-[0.2em]">Seeding (1-N)</label>
                                    <input
                                        type="number"
                                        value={newTeam.seed}
                                        onChange={(e) => setNewTeam({ ...newTeam, seed: e.target.value })}
                                        className="w-full bg-black border border-gray-800 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-blue-500 transition-all font-bold placeholder:text-gray-700"
                                        placeholder="1"
                                    />
                                </div>
                                {tournament?.teamSize > 0 && Array.from({ length: tournament.teamSize }).map((_, i) => (
                                    <div key={`player-${i}`} className="flex gap-4">
                                        <div className="flex-1">
                                            <label className="block text-[10px] font-black text-gray-500 mb-2 uppercase tracking-[0.2em]">Player {i + 1}</label>
                                            <input
                                                type="text"
                                                value={newTeam.players[i]?.name || ''}
                                                onChange={(e) => {
                                                    const newPlayers = [...newTeam.players];
                                                    if (!newPlayers[i]) newPlayers[i] = { name: '', seating: '' };
                                                    newPlayers[i] = { ...newPlayers[i], name: e.target.value };
                                                    setNewTeam({ ...newTeam, players: newPlayers });
                                                }}
                                                className="w-full bg-black border border-gray-800 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-blue-500 transition-all font-bold placeholder:text-gray-700"
                                                placeholder={`Player ${i + 1}`}
                                            />
                                        </div>
                                        <div className="w-1/3">
                                            <label className="block text-[10px] font-black text-gray-500 mb-2 uppercase tracking-[0.2em]">Seat</label>
                                            <input
                                                type="text"
                                                value={newTeam.players[i]?.seating || ''}
                                                onChange={(e) => {
                                                    const newPlayers = [...newTeam.players];
                                                    if (!newPlayers[i]) newPlayers[i] = { name: '', seating: '' };
                                                    newPlayers[i] = { ...newPlayers[i], seating: e.target.value };
                                                    setNewTeam({ ...newTeam, players: newPlayers });
                                                }}
                                                className="w-full bg-black border border-gray-800 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-blue-500 transition-all font-bold placeholder:text-gray-700"
                                                placeholder="A1"
                                            />
                                        </div>
                                    </div>
                                ))}
                                <button
                                    type="submit"
                                    className="w-full bg-blue-600 hover:bg-blue-700 py-5 rounded-2xl font-black italic uppercase tracking-tighter transition-all shadow-xl shadow-blue-600/20"
                                >
                                    Enroll Competitor
                                </button>
                            </form>
                        </section>

                        <section>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-black italic tracking-tighter uppercase flex items-center gap-2">
                                    <Trophy size={20} className="text-yellow-500" />
                                    Participants ({teams.length})
                                </h2>
                                <button 
                                    onClick={() => setIsTeamsExpanded(!isTeamsExpanded)}
                                    className="text-[10px] font-black uppercase tracking-widest text-blue-500"
                                >
                                    {isTeamsExpanded ? 'COLLAPSE' : 'EXPAND ALL'}
                                </button>
                            </div>
                            
                            {/* Search bar for quick scanning */}
                            <div className="mb-6 relative">
                                <input 
                                    type="text"
                                    placeholder="SEARCH TEAM OR PLAYER..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-[#111111] border border-gray-800 rounded-xl px-4 py-3 text-xs font-bold uppercase tracking-widest focus:outline-none focus:border-blue-500 transition-all placeholder:text-gray-700"
                                />
                            </div>

                            <div className="space-y-3">
                                {teams.filter(team => {
                                    if (!searchQuery) return true;
                                    const q = searchQuery.toLowerCase();
                                    return team.name.toLowerCase().includes(q) || 
                                           team.players?.some((p: any) => p.name.toLowerCase().includes(q) || p.seating?.toLowerCase().includes(q));
                                }).map((team) => (
                                    <div key={team.id} className="bg-[#111111] border border-gray-800 rounded-2xl overflow-hidden group hover:border-gray-700 transition-all">
                                        <div className="px-6 py-4 flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <span className="font-mono text-gray-700 font-bold">#{team.seed || '??'}</span>
                                                <div>
                                                    <span className="font-black uppercase tracking-tight block">{team.name}</span>
                                                    {(team.players?.length > 0) && (
                                                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1 block">
                                                            {team.players.length} Players Enrolled
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                {(team.players?.length > 0) && !isTeamsExpanded && (
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            // Logic for individual toggle if needed, or just let users expand all
                                                        }}
                                                        className="text-[10px] font-black text-gray-600 hover:text-blue-500 transition-colors uppercase"
                                                    >
                                                        Details
                                                    </button>
                                                )}
                                                <button className="text-gray-800 hover:text-red-500 transition-colors">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                        
                                        {/* Player seating list - optimized for mobile runners */}
                                        {(isTeamsExpanded || searchQuery) && team.players?.length > 0 && (
                                            <div className="px-6 pb-4 pt-2 border-t border-gray-800/50 bg-black/20 space-y-2">
                                                {team.players.map((p: any, idx: number) => (
                                                    <div key={idx} className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                                                        <span className="text-gray-400">{p.name}</span>
                                                        <span className="bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded border border-blue-600/30">
                                                            {p.seating || 'NO SEAT'}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {teams.length === 0 && (
                                    <div className="py-12 text-center text-gray-800 border-2 border-dashed border-gray-800 rounded-3xl">
                                        EMPTY ROSTER
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>

                    {/* RIGHT: Match Management */}
                    <div className="lg:col-span-2 space-y-12">
                        <div className="flex justify-between items-center">
                            <h2 className="text-2xl font-black italic tracking-tighter uppercase flex items-center gap-3">
                                <Sword size={28} className="text-red-500" />
                                Tournament Bracket
                            </h2>
                            <button
                                onClick={generateMatches}
                                disabled={generating || teams.length < 2}
                                className="bg-white/5 hover:bg-white/10 border border-gray-800 px-6 py-3 rounded-xl font-bold italic uppercase tracking-tighter flex items-center gap-2 transition-all disabled:opacity-30"
                            >
                                <Send size={18} />
                                {generating ? 'PROCESSING...' : (matches.length > 0 ? 'REGENERATE BRACKET' : 'INITIALIZE BRACKET')}
                            </button>
                        </div>

                        {matches.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {matches.map((match) => (
                                    <div
                                        key={match.id}
                                        className="bg-[#111111] border border-gray-800 p-6 rounded-3xl shadow-xl hover:border-blue-500/30 transition-all cursor-pointer group"
                                        onClick={() => openMatchModal(match)}
                                    >
                                        <div className="flex justify-between items-start mb-6">
                                            <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest bg-white/5 px-2 py-1 rounded">
                                                Round {match.round} • Match {match.matchOrder + 1}
                                            </span>
                                            {match.status === 'COMPLETED' ? (
                                                <span className="text-[10px] font-black text-green-500 uppercase tracking-widest flex items-center gap-1">
                                                    <Check size={12} /> FINAL
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-1 animate-pulse">
                                                    <X size={12} /> PENDING
                                                </span>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center bg-black/40 p-3 rounded-xl">
                                                <span className={`font-black uppercase tracking-tight truncate ${match.winnerId === match.homeTeamId ? 'text-blue-400' : 'text-gray-400'}`}>
                                                    {match.homeTeam?.name || 'TBD'}
                                                </span>
                                                <div className="flex items-center gap-3">
                                                    {(typeof match.mapScores === 'string' ? JSON.parse(match.mapScores) : (match.mapScores || [])).map((m: any, i: number) => (
                                                        <span key={i} className="text-[10px] text-gray-500 font-mono tracking-tighter">{m.home}</span>
                                                    ))}
                                                    <span className="font-mono text-xl font-black text-yellow-500 ml-2">{match.homeScore}</span>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center bg-black/40 p-3 rounded-xl">
                                                <span className={`font-black uppercase tracking-tight truncate ${match.winnerId === match.awayTeamId ? 'text-blue-400' : 'text-gray-400'}`}>
                                                    {match.awayTeam?.name || 'TBD'}
                                                </span>
                                                <div className="flex items-center gap-3">
                                                    {(typeof match.mapScores === 'string' ? JSON.parse(match.mapScores) : (match.mapScores || [])).map((m: any, i: number) => (
                                                        <span key={i} className="text-[10px] text-gray-500 font-mono tracking-tighter">{m.away}</span>
                                                    ))}
                                                    <span className="font-mono text-xl font-black text-yellow-500 ml-2">{match.awayScore}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-6 pt-4 border-t border-gray-800 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="text-xs text-gray-600 font-bold uppercase tracking-widest">
                                                BO{match.bestOf} • Limit {match.scoreLimit}
                                            </span>
                                            <span className="text-blue-500 font-black italic uppercase text-xs">Manage Match →</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-24 text-center border-2 border-dashed border-gray-800 rounded-[3rem] bg-[#111111]/30">
                                <ShieldAlert size={64} className="mx-auto text-gray-800 mb-6" />
                                <h3 className="text-xl font-black uppercase tracking-widest text-gray-700 mb-2">Bracket Not Initialized</h3>
                                <p className="text-gray-600 max-w-sm mx-auto font-bold uppercase text-xs tracking-widest">Enroll participants and click initialize to generate the competitive matches.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* MATCH CONTROL MODAL */}
            {editingMatch && (
                <div className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-center justify-center z-[100] p-4">
                    <div className="bg-[#111111] border border-gray-800 w-full max-w-2xl rounded-2xl md:rounded-[2.5rem] shadow-[0_0_100px_rgba(30,58,138,0.2)] overflow-y-auto max-h-[90vh]">
                        <header className="p-6 md:p-8 border-b border-gray-800 flex justify-between items-center bg-white/5 sticky top-0 z-20 backdrop-blur-md">
                            <div>
                                <h2 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter">MATCH CONTROLLER</h2>
                                <p className="text-[8px] md:text-[10px] text-gray-500 font-bold uppercase tracking-widest">Round {editingMatch.round} • {editingMatch.id.split('-')[0]}</p>
                            </div>
                            <button onClick={() => setEditingMatch(null)} className="p-2 md:p-3 hover:bg-white/10 rounded-full transition-all">
                                <X size={24} />
                            </button>
                        </header>

                        <form onSubmit={saveMatch} className="p-6 md:p-10 space-y-8 md:space-y-12">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 relative items-center">
                                <div className="hidden md:block absolute left-1/2 -ml-4 top-[5%] z-10 opacity-20">
                                    <div className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center font-black text-[10px]">VS</div>
                                </div>

                                <div className="space-y-4">
                                    <div className="p-4 md:p-6 bg-black border border-gray-800 rounded-2xl md:rounded-3xl text-center">
                                        <h3 className="text-[10px] md:text-xs font-black text-blue-500 mb-2 uppercase tracking-[0.2em]">{editingMatch.homeTeam?.name || 'TBD'}</h3>
                                        <p className="text-[8px] md:text-[10px] text-gray-500 font-bold tracking-widest uppercase mb-4 md:mb-6">Series Score: {matchForm.homeScore}</p>

                                        <div className="space-y-3 md:space-y-4">
                                            {matchForm.mapScores.map((m, i) => (
                                                <div key={i} className="flex flex-col gap-1 items-start bg-white/5 p-3 rounded-xl md:rounded-2xl border border-gray-800">
                                                    <div className="flex justify-between w-full items-center mb-1">
                                                        <label className="text-[8px] md:text-[10px] text-gray-600 font-bold uppercase tracking-widest">Map {i + 1}</label>
                                                        <select
                                                            value={m.map || ''}
                                                            onChange={(e) => updateMapScore(i, 'map', e.target.value)}
                                                            className="bg-transparent text-[8px] md:text-[10px] uppercase font-bold text-gray-400 focus:outline-none focus:text-white"
                                                        >
                                                            <option value="">TBA...</option>
                                                            {mapPool.map(poolMap => (
                                                                <option key={poolMap.id} value={poolMap.shortName}>{poolMap.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <input
                                                        type="number"
                                                        value={m.home || 0}
                                                        onChange={(e) => updateMapScore(i, 'home', parseInt(e.target.value) || 0)}
                                                        className="bg-black border border-gray-800 rounded-lg md:rounded-xl px-4 py-2 md:py-3 text-center text-lg md:text-xl font-black text-white focus:outline-none focus:border-blue-500 w-full"
                                                    />
                                                </div>
                                            ))}
                                        </div>

                                        {/* TEAM ROSTER & SEATING */}
                                        <div className="mt-4 pt-4 border-t border-gray-800/50">
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="w-1 h-3 bg-blue-500 rounded-full"></div>
                                                <span className="text-[8px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest">Team Roster</span>
                                            </div>
                                            <div className="grid grid-cols-1 gap-2 text-left">
                                                {editingMatch.homeTeam?.players?.map((player: any) => (
                                                    <div key={player.id} className="flex justify-between items-center bg-white/5 px-3 py-2 rounded-lg border border-gray-800/50">
                                                        <span className="text-[10px] md:text-xs font-bold text-gray-300">{player.name}</span>
                                                        <span className="text-[10px] md:text-px font-black text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                                                            {player.seating || 'N/A'}
                                                        </span>
                                                    </div>
                                                ))}
                                                {(!editingMatch.homeTeam?.players || editingMatch.homeTeam.players.length === 0) && (
                                                    <p className="text-[8px] md:text-[10px] text-gray-600 font-bold uppercase italic p-2 text-center">No players registered</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="p-4 md:p-6 bg-black border border-gray-800 rounded-2xl md:rounded-3xl text-center">
                                        <h3 className="text-[10px] md:text-xs font-black text-red-500 mb-2 uppercase tracking-[0.2em]">{editingMatch.awayTeam?.name || 'TBD'}</h3>
                                        <p className="text-[8px] md:text-[10px] text-gray-500 font-bold tracking-widest uppercase mb-4 md:mb-6">Series Score: {matchForm.awayScore}</p>

                                        <div className="space-y-3 md:space-y-4">
                                            {matchForm.mapScores.map((m, i) => (
                                                <div key={i} className="flex flex-col gap-1 items-start bg-white/5 p-3 rounded-xl md:rounded-2xl border border-gray-800">
                                                    <div className="flex justify-between w-full items-center mb-1">
                                                        <label className="text-[8px] md:text-[10px] text-gray-600 font-bold uppercase tracking-widest">Map {i + 1}</label>
                                                        <select
                                                            value={m.map || ''}
                                                            onChange={(e) => updateMapScore(i, 'map', e.target.value)}
                                                            className="bg-transparent text-[8px] md:text-[10px] uppercase font-bold text-gray-400 focus:outline-none focus:text-white"
                                                        >
                                                            <option value="">TBA...</option>
                                                            {mapPool.map(poolMap => (
                                                                <option key={poolMap.id} value={poolMap.shortName}>{poolMap.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <input
                                                        type="number"
                                                        value={m.away || 0}
                                                        onChange={(e) => updateMapScore(i, 'away', parseInt(e.target.value) || 0)}
                                                        className="bg-black border border-gray-800 rounded-lg md:rounded-xl px-4 py-2 md:py-3 text-center text-lg md:text-xl font-black text-white focus:outline-none focus:border-red-500 w-full"
                                                    />
                                                </div>
                                            ))}
                                        </div>

                                        {/* TEAM ROSTER & SEATING */}
                                        <div className="mt-4 pt-4 border-t border-gray-800/50">
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="w-1 h-3 bg-red-500 rounded-full"></div>
                                                <span className="text-[8px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest">Team Roster</span>
                                            </div>
                                            <div className="grid grid-cols-1 gap-2 text-left">
                                                {editingMatch.awayTeam?.players?.map((player: any) => (
                                                    <div key={player.id} className="flex justify-between items-center bg-white/5 px-3 py-2 rounded-lg border border-gray-800/50">
                                                        <span className="text-[10px] md:text-xs font-bold text-gray-300">{player.name}</span>
                                                        <span className="text-[10px] md:text-px font-black text-red-500 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                                                            {player.seating || 'N/A'}
                                                        </span>
                                                    </div>
                                                ))}
                                                {(!editingMatch.awayTeam?.players || editingMatch.awayTeam.players.length === 0) && (
                                                    <p className="text-[8px] md:text-[10px] text-gray-600 font-bold uppercase italic p-2 text-center">No players registered</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8 pt-8 border-t border-gray-800/50">
                                <div>
                                    <label className="block text-[8px] md:text-[10px] font-black text-gray-500 mb-3 md:mb-4 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <Settings2 size={14} /> Competitive Format
                                    </label>
                                    <select
                                        value={matchForm.bestOf}
                                        onChange={(e) => {
                                            const bo = parseInt(e.target.value) || 1;
                                            const newMaps = [...matchForm.mapScores];
                                            while (newMaps.length < bo) newMaps.push({ map: '', home: 0, away: 0 });
                                            setMatchForm({ ...matchForm, bestOf: bo, mapScores: newMaps.slice(0, bo) });
                                        }}
                                        className="w-full bg-black border border-gray-800 rounded-xl md:rounded-2xl px-4 md:px-6 py-3 md:py-4 font-black uppercase tracking-widest text-xs md:text-sm focus:outline-none focus:border-blue-500"
                                    >
                                        <option value={1}>Best of 1</option>
                                        <option value={3}>Best of 3</option>
                                        <option value={5}>Best of 5</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[8px] md:text-[10px] font-black text-gray-500 mb-3 md:mb-4 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <Trophy size={14} /> Series Win Limit
                                    </label>
                                    <input
                                        type="number"
                                        value={matchForm.scoreLimit}
                                        onChange={(e) => setMatchForm({ ...matchForm, scoreLimit: parseInt(e.target.value) || 1 })}
                                        className="w-full bg-black border border-gray-800 rounded-xl md:rounded-2xl px-4 md:px-6 py-3 md:py-4 font-black uppercase tracking-widest text-xs md:text-sm focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                            </div>


                            <button
                                type="submit"
                                className="w-full bg-blue-600 hover:bg-blue-700 py-4 md:py-6 rounded-2xl md:rounded-3xl font-black italic uppercase tracking-tighter text-lg md:text-xl transition-all shadow-2xl shadow-blue-600/30"
                            >
                                SUBMIT RESULTS & SYNC OVERLAY
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
