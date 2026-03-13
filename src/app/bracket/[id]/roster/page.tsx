'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function RosterOverlay({ params }: { params: { id: string } }) {
    const searchParams = useSearchParams();
    const chromaKey = searchParams.get('chroma') || 'transparent';

    const [teams, setTeams] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTeams = async () => {
            try {
                const res = await fetch(`/api/tournaments/${params.id}/teams`);
                const data = await res.json();
                if (Array.isArray(data)) {
                    setTeams(data);
                }
            } catch (error) {
                console.error('Failed to fetch teams', error);
            } finally {
                setLoading(false);
            }
        };
        fetchTeams();
        const interval = setInterval(fetchTeams, 10000); // Polling every 10s
        return () => clearInterval(interval);
    }, [params.id]);

    if (loading) return null;

    // Helper to extract up to 2 letters for the team initial block
    const getInitials = (name: string) => {
        if (!name) return '??';
        const words = name.trim().split(/\s+/);
        if (words.length >= 2) {
            return (words[0][0] + words[1][0]).toUpperCase();
        }
        return name.slice(0, 2).toUpperCase();
    };

    // Helper to generate a deterministic color based on team name string
    const stringToColor = (str: string) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const h = Math.abs(hash) % 360;
        return `hsl(${h}, 70%, 50%)`;
    };

    return (
        <div
            className="w-screen h-screen overflow-hidden p-12"
            style={{ backgroundColor: chromaKey === 'transparent' ? 'transparent' : chromaKey }}
        >
            <div className="grid grid-cols-4 gap-8">
                {teams.map((team, idx) => (
                    <div key={team.id || idx} className="bg-black/80 border-2 border-gray-800 rounded-3xl p-6 shadow-2xl backdrop-blur-sm flex flex-col gap-6 transform transition-all hover:scale-105">

                        {/* Team Header */}
                        <div className="flex items-center gap-5 border-b border-gray-800 pb-5">
                            <div
                                className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl text-white shadow-inner flex-shrink-0"
                                style={{ backgroundColor: stringToColor(team.name || '') }}
                            >
                                {getInitials(team.name)}
                            </div>
                            <div className="flex flex-col truncate">
                                <span className="text-gray-500 font-bold text-[10px] uppercase tracking-[0.3em] mb-1">Seed #{team.seed || '?'}</span>
                                <h2 className="text-2xl font-black text-white uppercase tracking-tighter truncate">{team.name}</h2>
                            </div>
                        </div>

                        {/* Players List */}
                        <div className="flex-1 flex flex-col gap-3">
                            {team.players && team.players.length > 0 ? (
                                team.players.map((p: any, i: number) => (
                                    <div key={p.id || i} className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5">
                                        <span className="text-gray-300 font-bold text-lg uppercase tracking-wider truncate">{p.name}</span>
                                        {p.seating && (
                                            <span className="text-blue-400 font-black font-mono text-xs bg-blue-900/30 px-2 py-1 rounded">
                                                {p.seating}
                                            </span>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="text-center text-gray-600 font-black uppercase text-xs tracking-widest py-8 opacity-50">
                                    No Players Enrolled
                                </div>
                            )}
                        </div>

                    </div>
                ))}
            </div>
        </div>
    );
}
