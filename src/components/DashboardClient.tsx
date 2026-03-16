'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Trophy, Layout, Eye, Settings, LogOut, Menu, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import TournamentWizard from '@/components/TournamentWizard';

export default function DashboardClient() {
    const queryClient = useQueryClient();
    const [isCreating, setIsCreating] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const router = useRouter();

    const { data, isLoading } = useQuery({
        queryKey: ['tournaments'],
        queryFn: async () => {
            const response = await fetch('/api/tournaments');
            return response.json();
        }
    });

    const tournaments = data?.tournaments || [];

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            router.push('/login');
            router.refresh();
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    const getTournamentTypeLabel = (type: string) => {
        return (type || 'SINGLE_ELIMINATION').replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    };

    const onWizardComplete = async (wizardData: any) => {
        try {
            const payload = {
                ...wizardData,
                type: wizardData.format // Backwards compatibility for UI rendering
            };

            const response = await fetch('/api/tournaments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            
            if (response.ok) {
                const result = await response.json();
                queryClient.invalidateQueries({ queryKey: ['tournaments'] });
                setIsCreating(false);
                return result.id;
            }
        } catch (error) {
            console.error('Failed to create via wizard:', error);
        }
    };

    return (
        <div className="flex h-screen bg-[#0d0f12] text-white overflow-hidden font-sans selection:bg-blue-500/30 relative">
            {/* MOBILE OVERLAY MENU */}
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
                                { id: "dashboard", icon: Layout, label: "Dashboard", onClick: () => setIsMenuOpen(false) },
                                { id: "create", icon: Plus, label: "Create Tournament", onClick: () => { setIsCreating(true); setIsMenuOpen(false); } },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={tab.onClick}
                                    className="flex items-center gap-4 p-4 rounded-2xl hover:bg-blue-600/10 hover:text-blue-500 transition-all font-bold uppercase tracking-widest text-xs"
                                >
                                    <tab.icon size={20} />
                                    {tab.label}
                                </button>
                            ))}
                        </nav>
                        <div className="mt-auto">
                            <button 
                                onClick={handleLogout}
                                className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-red-500/10 hover:text-red-500 transition-all font-bold uppercase tracking-widest text-xs"
                            >
                                <LogOut size={20} />
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* LEFT SIDEBAR (SLIM - DESKTOP ONLY) */}
            <aside className="hidden md:flex w-20 bg-[#16191d] border-r border-white/5 flex-col items-center py-8 gap-10 shrink-0">
                <Link href="/" className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20 active:scale-95 transition-all">
                    <Trophy size={24} className="text-white" />
                </Link>
                
                <nav className="flex flex-col gap-6">
                    {[
                        { id: "dashboard", icon: Layout, label: "Dashboard" },
                        { id: "create", icon: Plus, label: "Create", onClick: () => setIsCreating(true) },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={tab.onClick || (() => {})}
                            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all group relative text-gray-500 hover:text-white hover:bg-white/5`}
                        >
                            <tab.icon size={22} strokeWidth={2} />
                            <span className="absolute left-20 bg-black text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all whitespace-nowrap z-50 shadow-2xl">
                                {tab.label}
                            </span>
                        </button>
                    ))}
                </nav>

                <div className="mt-auto flex flex-col gap-6">
                    <button 
                        onClick={handleLogout}
                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-gray-500 hover:text-red-500 transition-all group relative"
                    >
                        <LogOut size={22} />
                        <span className="absolute left-20 bg-black text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all whitespace-nowrap z-50 shadow-2xl">
                            Logout
                        </span>
                    </button>
                </div>
            </aside>

            {/* MAIN CONTENT AREA */}
            <main className="flex-1 flex flex-col relative overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.05),transparent_40%)]">
                {/* HEADER */}
                <header className="h-24 px-6 md:px-10 flex items-center justify-between border-b border-white/5 shrink-0 gap-4">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => setIsMenuOpen(true)}
                            className="p-2 hover:bg-white/5 rounded-xl transition-all md:hidden text-gray-400"
                        >
                            <Menu size={24} />
                        </button>
                        <div className="truncate">
                            <h1 className="text-lg md:text-2xl font-extrabold tracking-tight uppercase truncate">Management Dashboard</h1>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">
                                {tournaments.length} Active Tournaments
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <button
                            onClick={() => setIsCreating(true)}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-4 md:px-8 h-10 md:h-12 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs tracking-widest transition-all shadow-lg shadow-blue-600/20 active:scale-95 flex items-center gap-2 md:gap-3 uppercase whitespace-nowrap"
                        >
                            <Plus size={16} /> <span className="hidden sm:inline">Create Tournament</span><span className="sm:hidden text-[8px]">New</span>
                        </button>
                    </div>
                </header>

                {/* SCROLLABLE CONTENT */}
                <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">

                {isCreating && (
                    <TournamentWizard 
                        onClose={() => setIsCreating(false)}
                        onComplete={onWizardComplete}
                    />
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {isLoading ? (
                        <div className="col-span-full py-20 text-center animate-pulse text-gray-500 font-bold uppercase tracking-widest">
                            Loading Tournaments...
                        </div>
                    ) : tournaments.length === 0 ? (
                        <div className="col-span-full py-20 text-center border-2 border-dashed border-white/5 rounded-[2.5rem] bg-white/[0.02]">
                            <Trophy size={48} className="mx-auto text-gray-800 mb-6" />
                            <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">No tournaments found</p>
                            <button 
                                onClick={() => setIsCreating(true)}
                                className="mt-6 text-blue-500 font-black uppercase text-[10px] tracking-widest hover:text-white transition-all"
                            >
                                Start your first competition
                            </button>
                        </div>
                    ) : (
                        tournaments.map((tournament: any) => (
                            <div
                                key={tournament.id}
                                className="group bg-[#16191d] border border-white/5 p-8 rounded-[2rem] hover:border-blue-500/30 transition-all shadow-xl relative overflow-hidden flex flex-col"
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 blur-[40px] rounded-full -mr-16 -mt-16 group-hover:bg-blue-600/10 transition-all duration-700"></div>
                                
                                <div className="flex justify-between items-start mb-8 relative z-10">
                                    <div className="flex items-center gap-3">
                                        <span className="text-[9px] font-black text-blue-500 bg-blue-500/10 px-3 py-1 rounded-full uppercase tracking-widest border border-blue-500/20">
                                            {tournament.game || 'CS2'}
                                        </span>
                                        <span className="text-[9px] font-black text-gray-500 bg-white/5 px-3 py-1 rounded-full uppercase tracking-widest border border-white/5">
                                            {getTournamentTypeLabel(tournament.format || tournament.type)}
                                        </span>
                                    </div>
                                    <Link href={`/dashboard/tournaments/${tournament.id}`} className="p-2 bg-white/5 hover:bg-blue-500/10 rounded-xl transition-all text-gray-500 hover:text-blue-500">
                                        <Settings size={18} />
                                    </Link>
                                </div>

                                <h3 className="text-2xl font-extrabold uppercase tracking-tighter mb-8 group-hover:text-white transition-colors">{tournament.name}</h3>
                                
                                <div className="mt-auto grid grid-cols-2 gap-4 relative z-10">
                                    <Link
                                        href={`/dashboard/tournaments/${tournament.id}`}
                                        className="flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/5 active:scale-95"
                                    >
                                        <Layout size={14} className="text-blue-500" />
                                        MANAGE
                                    </Link>
                                    <Link
                                        href={`/bracket/${tournament.id}/overlay`}
                                        target="_blank"
                                        className="flex items-center justify-center gap-3 bg-blue-600/10 text-blue-500 hover:bg-blue-600 hover:text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-blue-500/20 active:scale-95"
                                    >
                                        <Eye size={14} />
                                        OVERLAY
                                    </Link>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                </div>
            </main>

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
            `}</style>
        </div>
    );
}
