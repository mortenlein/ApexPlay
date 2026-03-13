'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Trophy, Layout, Eye, Settings } from 'lucide-react';

export default function Dashboard() {
    const [tournaments, setTournaments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [newTournament, setNewTournament] = useState({
        name: '',
        format: 'SINGLE_ELIMINATION',
        teamSize: '5',
        bo3StartRound: '',
        bo5StartRound: '',
        hasThirdPlace: false
    });

    useEffect(() => {
        fetchTournaments();
    }, []);

    const fetchTournaments = async () => {
        try {
            const response = await fetch('/api/tournaments');
            const data = await response.json();
            setTournaments(data);
        } catch (error) {
            console.error('Failed to fetch:', error);
        } finally {
            setLoading(false);
        }
    };

    const createTournament = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Convert to payload
            const payload = {
                ...newTournament,
                type: newTournament.format // Backwards compatibility for UI rendering
            };

            const response = await fetch('/api/tournaments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (response.ok) {
                setNewTournament({
                    name: '',
                    format: 'SINGLE_ELIMINATION',
                    teamSize: '5',
                    bo3StartRound: '',
                    bo5StartRound: '',
                    hasThirdPlace: false
                });
                setIsCreating(false);
                fetchTournaments();
            }
        } catch (error) {
            console.error('Failed to create:', error);
        }
    };

    const getTournamentTypeLabel = (type: string) => {
        return (type || 'SINGLE_ELIMINATION').replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white font-sans p-8">
            <div className="max-w-6xl mx-auto">
                <header className="flex justify-between items-center mb-12">
                    <div>
                        <h1 className="text-4xl font-black bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
                            APEXGRID
                        </h1>
                        <p className="text-gray-400 mt-1 uppercase tracking-widest text-sm">Management Dashboard</p>
                    </div>
                    <button
                        onClick={() => setIsCreating(true)}
                        className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:scale-105 transition-all text-white px-6 py-3 rounded-xl font-bold"
                    >
                        <Plus size={20} />
                        CREATE TOURNAMENT
                    </button>
                </header>

                {isCreating && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center z-50 p-4 overflow-y-auto pt-24">
                        <div className="bg-[#1a1a1a] border border-gray-800 p-8 rounded-2xl w-full max-w-2xl shadow-2xl my-auto">
                            <h2 className="text-2xl font-bold mb-6">Create New Tournament</h2>
                            <form onSubmit={createTournament} className="space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-400 mb-2">Tournament Name</label>
                                        <input
                                            type="text"
                                            required
                                            value={newTournament.name}
                                            onChange={(e) => setNewTournament({ ...newTournament, name: e.target.value })}
                                            className="w-full bg-[#2a2a2a] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                            placeholder="E.g. Apex Legends Autumn Cup"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-2">Bracket Format</label>
                                        <select
                                            value={newTournament.format}
                                            onChange={(e) => setNewTournament({ ...newTournament, format: e.target.value })}
                                            className="w-full bg-[#2a2a2a] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                        >
                                            <option value="SINGLE_ELIMINATION">Single Elimination</option>
                                            <option value="DOUBLE_ELIMINATION">Double Elimination</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-2">Team Size</label>
                                        <select
                                            value={newTournament.teamSize}
                                            onChange={(e) => setNewTournament({ ...newTournament, teamSize: e.target.value })}
                                            className="w-full bg-[#2a2a2a] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                        >
                                            <option value="2">2v2 (Duos)</option>
                                            <option value="5">5v5 (Standard)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-2">BO3 Starts At Round (Optional)</label>
                                        <input
                                            type="number"
                                            value={newTournament.bo3StartRound}
                                            onChange={(e) => setNewTournament({ ...newTournament, bo3StartRound: e.target.value })}
                                            className="w-full bg-[#2a2a2a] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                            placeholder="e.g. 2 for Semi-Finals in 4-team"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Leave empty for BO1 default</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-2">BO5 Starts At Round (Optional)</label>
                                        <input
                                            type="number"
                                            value={newTournament.bo5StartRound}
                                            onChange={(e) => setNewTournament({ ...newTournament, bo5StartRound: e.target.value })}
                                            className="w-full bg-[#2a2a2a] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                            placeholder="e.g. 3 for Grand Final"
                                        />
                                    </div>

                                    <div className="col-span-2 flex items-center gap-3 bg-[#2a2a2a] p-4 rounded-lg border border-gray-700 mt-2">
                                        <input
                                            type="checkbox"
                                            id="thirdPlaceCheck"
                                            checked={newTournament.hasThirdPlace}
                                            onChange={(e) => setNewTournament({ ...newTournament, hasThirdPlace: e.target.checked })}
                                            className="w-5 h-5 rounded border-gray-600 text-blue-600 focus:ring-blue-500 bg-black"
                                        />
                                        <label htmlFor="thirdPlaceCheck" className="text-sm font-medium text-gray-300 select-none cursor-pointer">
                                            Enable 3rd Place Decider Match
                                        </label>
                                    </div>
                                </div>
                                <div className="flex gap-4 pt-4 border-t border-gray-800">
                                    <button
                                        type="button"
                                        onClick={() => setIsCreating(false)}
                                        className="flex-1 px-6 py-4 rounded-xl border border-gray-700 font-bold hover:bg-white/5 transition-all text-gray-300"
                                    >
                                        CANCEL
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 px-6 py-4 rounded-xl font-black italic tracking-tighter text-lg transition-all shadow-lg shadow-blue-600/20"
                                    >
                                        CREATE TOURNAMENT
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading ? (
                        <div className="col-span-full py-20 text-center animate-pulse text-gray-500 font-bold uppercase tracking-widest">
                            Loading Tournaments...
                        </div>
                    ) : tournaments.length === 0 ? (
                        <div className="col-span-full py-20 text-center border-2 border-dashed border-gray-800 rounded-2xl">
                            <Trophy size={48} className="mx-auto text-gray-700 mb-4" />
                            <p className="text-gray-500 font-medium">No tournaments found. Create your first one to get started!</p>
                        </div>
                    ) : (
                        tournaments.map((tournament) => (
                            <div
                                key={tournament.id}
                                className="group bg-[#111111] border border-gray-800 p-6 rounded-2xl hover:border-blue-500/50 transition-all shadow-xl hover:shadow-blue-500/10 cursor-pointer border-l-4 border-l-blue-600"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <span className="text-xs font-bold text-blue-500 bg-blue-500/10 px-2 py-1 rounded uppercase tracking-tighter">
                                        {getTournamentTypeLabel(tournament.type)}
                                    </span>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Link href={`/dashboard/tournaments/${tournament.id}`} className="p-2 hover:bg-[#222222] rounded-lg transition-colors text-gray-400">
                                            <Settings size={18} />
                                        </Link>
                                    </div>
                                </div>
                                <h3 className="text-xl font-bold mb-6 line-clamp-1">{tournament.name}</h3>
                                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-800">
                                    <Link
                                        href={`/dashboard/tournaments/${tournament.id}`}
                                        className="flex items-center justify-center gap-2 bg-[#1a1a1a] hover:bg-[#2a2a2a] py-3 rounded-xl text-sm font-bold transition-all"
                                    >
                                        <Layout size={16} />
                                        MANAGE
                                    </Link>
                                    <Link
                                        href={`/bracket/${tournament.id}/overlay`}
                                        target="_blank"
                                        className="flex items-center justify-center gap-2 bg-purple-600/10 text-purple-400 hover:bg-purple-600/20 py-3 rounded-xl text-sm font-bold transition-all"
                                    >
                                        <Eye size={16} />
                                        OVERLAY
                                    </Link>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
