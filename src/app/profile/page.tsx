'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { ShieldCheck, Loader2, Gamepad2, Star, ArrowRight, Shield, Activity, Zap, Hash, Users, Link2, Settings2, LogOut } from 'lucide-react';
import { MockPersonaButtons } from '@/components/MockPersonaButtons';

export default function ProfilePage() {
    const { data: session, status } = useSession();

    const { data: profile, isLoading } = useQuery({
        queryKey: ['profile'],
        queryFn: async () => {
            const res = await fetch('/api/user/profile?view=profile');
            if (!res.ok) throw new Error('Failed to fetch profile');
            return res.json();
        },
        enabled: status === 'authenticated',
        staleTime: 60_000,
    });

    if (status === 'loading' || (status === 'authenticated' && isLoading)) {
        return (
            <div className="min-h-screen bg-[var(--mds-page)] flex flex-col items-center justify-center gap-6">
                <Loader2 className="animate-spin text-[var(--mds-action)]" size={40} />
                <span className="mds-uppercase-label opacity-40">Loading Competitor Profile...</span>
            </div>
        );
    }

    if (status === 'unauthenticated') {
        return (
            <div className="min-h-screen bg-[var(--mds-page)] flex flex-col items-center justify-center p-8 text-center gap-10">
                <div className="h-20 w-20 rounded-mds-comfortable flex items-center justify-center bg-[var(--mds-action)]/10 border border-[var(--mds-action)]/20 shadow-mds-whisper">
                    <ShieldCheck size={40} className="text-[var(--mds-action)]" />
                </div>
                <div className="max-w-md space-y-4">
                    <h1 className="font-brand text-4xl font-black tracking-tight text-[var(--mds-text-primary)] uppercase leading-[0.9]">Authentication <br/> <span className="text-[var(--mds-action)]">Required</span></h1>
                    <p className="text-[var(--mds-text-muted)] font-medium leading-relaxed">
                        Connect your identity to see your teams, current tournaments, and account details.
                    </p>
                </div>
                <button
                    onClick={() => signIn('steam')}
                    className="mds-btn-primary h-14 px-10 text-xs font-bold uppercase tracking-widest gap-3"
                >
                    <Zap size={16} fill="currentColor" />
                    Continue with Steam
                </button>
                <MockPersonaButtons callbackUrl="/profile" />
            </div>
        );
    }

    const { registrations = [], stats } = profile || {};

    return (
        <div className="min-h-screen bg-[var(--mds-page)]">
            <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-24 space-y-12">

                {/* COMPETITOR HEADER */}
                <section className="mds-card p-0 overflow-hidden border-[var(--mds-border)] shadow-2xl">
                    <div className="h-32 w-full bg-[var(--mds-input)]/30 border-b border-[var(--mds-border)] relative overflow-hidden">
                         <div className="absolute inset-0 opacity-10">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,var(--mds-action)_0%,transparent_70%)] blur-2xl" />
                         </div>
                         <div className="absolute bottom-0 left-12 h-1 w-24 bg-[var(--mds-action)] shadow-[0_0_12px_var(--mds-action)]" />
                    </div>
                    
                    <div className="px-12 pb-12 relative">
                        <div className="flex flex-col md:flex-row items-end gap-8 -mt-16">
                            {/* AVATAR UNIT */}
                            <div className="relative shrink-0 group">
                                <div className="h-32 w-32 rounded-mds-comfortable bg-[var(--mds-page)] p-1.5 border-2 border-[var(--mds-border)] shadow-mds-whisper group-hover:border-[var(--mds-action)] transition-all duration-500 overflow-hidden">
                                    <Image
                                        src={session?.user?.image || 'https://api.dicebear.com/9.x/initials/svg?seed=U'}
                                        alt="Profile"
                                        width={128}
                                        height={128}
                                        className="rounded-mds-comfortable w-full h-full object-cover"
                                    />
                                </div>
                                <div className="absolute -bottom-2 -right-2 h-10 w-10 rounded-mds-comfortable bg-[var(--mds-action)] flex items-center justify-center border-4 border-[var(--mds-page)] shadow-lg animate-in zoom-in duration-700 delay-300">
                                    <Star size={16} className="fill-white text-white" />
                                </div>
                            </div>

                            {/* COMPETITOR IDENTITY */}
                            <div className="flex-1 space-y-4 mb-2">
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-3">
                                        <span className="mds-badge bg-[var(--mds-action)]/10 text-[var(--mds-action)] font-black uppercase text-[8px] tracking-widest border-[var(--mds-action)]/20">Player profile</span>
                                        <div className="h-1 w-1 rounded-full bg-[var(--mds-green)] animate-pulse shadow-[0_0_8px_var(--mds-green)]" />
                                    </div>
                                    <h1 className="font-brand text-4xl md:text-5xl font-black tracking-tighter text-[var(--mds-text-primary)] uppercase leading-[0.9]">
                                        {session?.user?.name}
                                    </h1>
                                </div>

                                <div className="flex flex-wrap items-center gap-10">
                                    {[
                                        { label: 'Tournaments', value: String(stats?.tournamentsJoined || 0), highlight: true, icon: Activity },
                                        { label: 'Teams Led', value: String(stats?.teamsLed || 0), icon: Shield },
                                        { label: 'Steam ID', value: (session?.user as any)?.steamId?.slice(-8), mono: true, icon: Hash },
                                    ].map((stat, i) => (
                                        <div key={i} className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-md bg-[var(--mds-input)] flex items-center justify-center text-[var(--mds-text-muted)] border border-[var(--mds-border)]">
                                                <stat.icon size={14} />
                                            </div>
                                            <div className="space-y-0.5">
                                                <p className="mds-uppercase-label text-[8px] opacity-40">{stat.label}</p>
                                                <p className={`font-brand text-sm font-bold ${stat.mono ? 'font-mono tracking-wider' : ''} ${stat.highlight ? 'text-[var(--mds-action)]' : 'text-[var(--mds-text-primary)]'}`}>
                                                    {stat.value}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button className="mds-btn-secondary h-12 px-8 text-xs font-bold gap-2 self-start md:self-end">
                                <Settings2 size={16} /> Profile Settings
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    try {
                                        await fetch('/api/auth/logout', { method: 'POST' });
                                    } catch {
                                        // Best effort admin-cookie cleanup before NextAuth sign-out.
                                    }
                                    await signOut({ callbackUrl: '/' });
                                }}
                                className="mds-btn-secondary h-12 px-8 text-xs font-bold gap-2 self-start md:self-end"
                            >
                                <LogOut size={16} /> Sign out
                            </button>
                        </div>
                    </div>
                </section>

                {/* COMPETITION DATA GRID */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
                    
                    {/* LEFT: Tournament Log */}
                    <div className="lg:col-span-8 space-y-6">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-4">
                                <h2 className="mds-uppercase-label text-[10px] tracking-[0.2em]">Competition History</h2>
                                <div className="h-px w-24 bg-[var(--mds-border)]/50" />
                            </div>
                            <span className="mds-badge bg-[var(--mds-input)] font-bold text-[9px] opacity-60 uppercase">{registrations?.length || 0} TOURNAMENTS</span>
                        </div>

                        <div className="space-y-4">
                            {registrations?.length > 0 ? registrations.map((reg: any) => (
                                <Link
                                    key={reg.id}
                                    href={`/tournaments/${reg.team.tournament.id}`}
                                    className="group mds-card p-6 flex flex-col md:flex-row items-center justify-between gap-6 hover:border-[var(--mds-action)]/40 transition-all duration-500 bg-[var(--mds-input)]/20 shadow-mds-whisper"
                                >
                                    <div className="flex items-center gap-6 flex-1 min-w-0">
                                        <div className="h-14 w-14 rounded-mds-comfortable bg-[var(--mds-page)] border border-[var(--mds-border)] group-hover:border-[var(--mds-action)]/30 transition-all flex items-center justify-center p-3 shadow-mds-inner shrink-0 overflow-hidden relative">
                                            <Gamepad2 size={24} className="text-[var(--mds-action)] opacity-40 group-hover:opacity-100 transition-opacity" />
                                            <div className="absolute inset-0 bg-[var(--mds-action)]/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                        <div className="truncate">
                                            <h3 className="font-brand text-xl font-bold text-[var(--mds-text-primary)] leading-tight group-hover:text-[var(--mds-action)] transition-colors truncate">
                                                {reg.team.tournament.name}
                                            </h3>
                                            <div className="flex items-center gap-3 mt-2">
                                                <span className="mds-badge bg-[var(--mds-page)] text-[8px] font-bold opacity-60 uppercase tracking-widest">{reg.team.tournament.game}</span>
                                                <span className="h-1 w-1 rounded-full bg-[var(--mds-border)]" />
                                                <span className="mds-uppercase-label text-[9px] text-[var(--mds-action)] font-black italic">{reg.team.name}</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-10 shrink-0">
                                        <div className="hidden sm:block text-right">
                                            <p className="mds-uppercase-label text-[8px] opacity-40 mb-1">Tournament Date</p>
                                            <p className="font-brand text-sm font-bold text-[var(--mds-text-primary)]">
                                                {new Date(reg.team.tournament.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}
                                            </p>
                                        </div>
                                        <div className="h-10 w-10 rounded-full border border-[var(--mds-border)] flex items-center justify-center group-hover:bg-[var(--mds-action)] group-hover:border-[var(--mds-action)] group-hover:text-white transition-all shadow-mds-whisper">
                                            <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                                        </div>
                                    </div>
                                </Link>
                            )) : (
                                <div className="mds-card p-24 text-center border-dashed border-2 border-[var(--mds-border)] bg-[var(--mds-input)]/20 shadow-none">
                                    <div className="h-16 w-16 mx-auto mb-8 bg-[var(--mds-border)]/20 flex items-center justify-center rounded-xl text-[var(--mds-text-muted)]">
                                        <Gamepad2 size={32} />
                                    </div>
                                    <h3 className="font-brand text-2xl font-bold mb-3 text-[var(--mds-text-primary)] opacity-60 uppercase">No tournament history yet</h3>
                                    <p className="text-[var(--mds-text-muted)] font-medium max-w-xs mx-auto leading-relaxed mb-8">
                                        Tournament history has not been established for this competitor identity. 
                                    </p>
                                    <Link href="/tournaments" className="mds-btn-primary h-12 px-8 text-xs font-bold uppercase gap-2">
                                        Browse Tournaments <ArrowRight size={14} />
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT: Account Summary */}
                    <div className="lg:col-span-4 space-y-10 sticky top-24">
                        <section className="space-y-6">
                            <div className="flex items-center gap-4 mb-2">
                                <h2 className="mds-uppercase-label text-[10px] tracking-[0.2em]">Account Summary</h2>
                                <div className="h-px flex-1 bg-[var(--mds-border)]/50" />
                            </div>

                            <div className="mds-card p-10 space-y-10 shadow-2xl border-[var(--mds-border)]">
                                <div className="grid grid-cols-1 gap-6">
                                    {[
                                        { label: 'Open Matches', value: String(stats?.activeMatches || 0), icon: Gamepad2, color: 'var(--mds-green)' },
                                        { label: 'Seat Assignments', value: String(stats?.seatAssignments || 0), icon: Users, color: 'var(--mds-action)' },
                                    ].map(stat => (
                                        <div key={stat.label} className="p-6 mds-card bg-[var(--mds-input)]/30 border-[var(--mds-border)]/50 flex items-center justify-between group">
                                            <div>
                                                <p className="mds-uppercase-label text-[8px] opacity-40 mb-1.5">{stat.label}</p>
                                                <p className="font-brand text-3xl font-black tracking-tighter text-[var(--mds-text-primary)]">{stat.value}</p>
                                            </div>
                                            <div className="h-12 w-12 rounded-mds-comfortable bg-[var(--mds-page)] border border-[var(--mds-border)] flex items-center justify-center shrink-0 group-hover:border-[var(--mds-action)]/40 transition-all opacity-40 group-hover:opacity-100" style={{ color: stat.color }}>
                                                <stat.icon size={20} />
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-6">
                                        <h4 className="mds-uppercase-label text-[9px] opacity-50 tracking-[0.15em]">Connected Platforms</h4>
                                        <div className="h-1 w-8 bg-[var(--mds-border)]" />
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between p-5 mds-card bg-[var(--mds-input)]/20 border-none group cursor-pointer hover:bg-[var(--mds-input)]/40 transition-all">
                                            <div className="flex items-center gap-4">
                                                <div className="h-10 w-10 bg-[var(--mds-page)] rounded-mds-comfortable flex items-center justify-center text-[var(--mds-text-muted)] border border-[var(--mds-border)] shadow-mds-inner group-hover:border-[var(--mds-action)]/30 transition-all">
                                                    <Gamepad2 size={18} />
                                                </div>
                                                <p className="font-brand text-sm font-bold text-[var(--mds-text-primary)]">Steam</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="h-1.5 w-1.5 rounded-full bg-[var(--mds-green)] animate-pulse" />
                                                <span className="mds-uppercase-label text-[8px] opacity-40">Connected</span>
                                            </div>
                                        </div>
                                        
                                        <div className={`flex items-center justify-between p-5 mds-card border-none ${stats?.connectedAccounts > 1 ? 'bg-[var(--mds-input)]/20' : 'bg-[var(--mds-input)]/10 opacity-60'} transition-all`}>
                                            <div className="flex items-center gap-4">
                                                <div className="h-10 w-10 bg-[var(--mds-page)] rounded-mds-comfortable flex items-center justify-center text-[var(--mds-text-muted)] border border-[var(--mds-border)]">
                                                    <Link2 size={18} />
                                                </div>
                                                <p className="font-brand text-sm font-bold text-[var(--mds-text-primary)]">Extra linked account</p>
                                            </div>
                                            <span className="mds-badge bg-[var(--mds-border)]/20 text-[8px] opacity-70">
                                                {stats?.connectedAccounts > 1 ? 'Connected' : 'Not linked'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-dashed border-[var(--mds-border)] p-6 text-sm text-[var(--mds-text-muted)] leading-relaxed">
                                    This page now shows the data ApexPlay actually tracks: teams, open matches, seat assignments, and linked accounts.
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}
