'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Trophy, Users, ShieldCheck, ArrowRight, CheckCircle2, AlertCircle, Loader2, Gamepad2, Upload, User, MapPin, AtSign } from 'lucide-react';
import Link from 'next/link';

export default function RegisterPage({ params }: { params: { id: string } }) {
    const [tournament, setTournament] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [teamData, setTeamData] = useState({
        name: '',
        logoUrl: '',
        players: Array(5).fill({ name: '', seating: '', steamId: '' })
    });
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);

    useEffect(() => {
        const fetchTournament = async () => {
            try {
                const res = await fetch(`/api/tournaments/${params.id}`);
                const current = await res.json();
                if (res.ok) {
                    setTournament(current);
                    setTeamData(prev => ({
                        ...prev,
                        players: Array(current.teamSize || 5).fill({ name: '', seating: '', steamId: '' })
                    }));
                } else {
                    setError('Tournament not found');
                }
            } catch (err) {
                setError('Failed to load tournament details');
            } finally {
                setLoading(false);
            }
        };
        fetchTournament();
    }, [params.id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        try {
            let logoUrl = teamData.logoUrl;

            if (logoFile) {
                const uploadData = new FormData();
                uploadData.append('file', logoFile);
                const uploadRes = await fetch('/api/upload', {
                    method: 'POST',
                    body: uploadData
                });
                if (!uploadRes.ok) throw new Error('Logo upload failed');
                const { url } = await uploadRes.json();
                logoUrl = url;
            }

            const cleanedPlayers = teamData.players.filter(p => p.name.trim() !== '');
            
            if (cleanedPlayers.length < (tournament?.teamSize || 1)) {
                throw new Error(`Minimum ${tournament?.teamSize || 1} players required`);
            }

            const res = await fetch(`/api/tournaments/${params.id}/teams`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: teamData.name,
                    logoUrl: logoUrl,
                    players: cleanedPlayers
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Registration failed');
            }

            setSuccess(true);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const updatePlayer = (index: number, field: string, value: string) => {
        const newPlayers = [...teamData.players];
        newPlayers[index] = { ...newPlayers[index], [field]: value };
        setTeamData({ ...teamData, players: newPlayers });
    };

    if (loading) return (
        <div className="min-h-screen bg-[#0d0f12] flex flex-col items-center justify-center gap-6">
            <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-500">Decrypting Payload...</span>
        </div>
    );

    if (success) {
        return (
            <div className="min-h-screen bg-[#0d0f12] flex items-center justify-center p-6 relative overflow-hidden font-sans">
                {/* Glow Background */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-green-500/5 blur-[120px] rounded-full pointer-events-none"></div>
                
                <div className="max-w-xl w-full bg-[#16191d] border border-white/5 rounded-[3.5rem] p-16 text-center shadow-2xl relative z-10 overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/5 blur-[60px] rounded-full -mr-32 -mt-32"></div>
                    
                    <div className="w-24 h-24 bg-green-500/10 rounded-[2rem] flex items-center justify-center border border-green-500/20 mx-auto mb-10 shadow-2xl shadow-green-500/10">
                        <CheckCircle2 className="w-12 h-12 text-green-500" />
                    </div>
                    
                    <h1 className="text-4xl font-extrabold uppercase tracking-tighter text-white mb-4 not-italic">Registration Verified</h1>
                    <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px] mb-12 max-w-sm mx-auto leading-relaxed not-italic">
                        Your unit <span className="text-green-500">"{teamData.name}"</span> has been successfully deployed into the <span className="text-white">{tournament?.name}</span> infrastructure.
                    </p>
                    
                    <Link 
                        href={`/tournaments/${params.id}`}
                        className="inline-flex items-center gap-3 bg-blue-600 hover:bg-blue-500 text-white px-12 py-6 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all shadow-xl shadow-blue-600/20 active:scale-95"
                    >
                        Access Tournament Hub <ArrowRight size={16} />
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0d0f12] text-white selection:bg-blue-500 selection:text-white font-sans overflow-x-hidden">
            {/* Background Decor */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-blue-600/[0.03] blur-[150px] rounded-full"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-purple-600/[0.03] blur-[150px] rounded-full"></div>
            </div>

            <div className="relative z-10 max-w-5xl mx-auto px-10 py-20 md:py-32">
                <header className="text-center mb-24 space-y-8">
                    <div className="inline-flex items-center gap-3 bg-white/5 border border-white/5 px-6 py-2 rounded-full shadow-2xl">
                        <Trophy size={14} className="text-blue-500" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Battle Entry Interface</span>
                    </div>
                    <div className="space-y-4">
                        <h1 className="text-6xl md:text-8xl font-extrabold uppercase tracking-tighter text-white leading-none not-italic">
                            {tournament?.name || 'INITIALIZING...'}
                        </h1>
                        <p className="text-gray-500 font-bold uppercase tracking-[0.4em] text-[10px] not-italic">
                            {tournament?.teamSize}v{tournament?.teamSize} Competitive Protocol • Single Elimination
                        </p>
                    </div>
                </header>

                <main>
                    <form onSubmit={handleSubmit} className="space-y-12">
                        {/* Section: Team Details */}
                        <section className="bg-[#16191d] border border-white/5 rounded-[3rem] p-12 md:p-16 shadow-2xl relative overflow-hidden group hover:border-white/10 transition-all">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/[0.02] blur-[80px] rounded-full -mr-32 -mt-32"></div>
                            
                            <div className="flex items-center justify-between mb-16 relative z-10">
                                <h2 className="text-2xl font-extrabold uppercase tracking-tighter flex items-center gap-4 not-italic">
                                    <Users className="text-blue-500" size={28} />
                                    01. Team Identity
                                </h2>
                                <span className="text-[10px] font-black text-white/5 uppercase tracking-[0.4em] not-italic">Section Alpha</span>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 relative z-10">
                                <div className="lg:col-span-12 space-y-12">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                        <div className="space-y-4">
                                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">Team Designation</label>
                                            <div className="relative">
                                                <input 
                                                    type="text"
                                                    required
                                                    value={teamData.name}
                                                    onChange={(e) => setTeamData({ ...teamData, name: e.target.value })}
                                                    className="w-full bg-black/40 border border-white/5 rounded-[1.5rem] px-8 py-6 text-xl font-bold text-white focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-white/5"
                                                    placeholder="Enter Team Name..."
                                                />
                                                <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-20"><Gamepad2 size={24} /></div>
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">Upload Insignia</label>
                                            <div className="relative group/file">
                                                <input 
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                            setLogoFile(file);
                                                            setLogoPreview(URL.createObjectURL(file));
                                                        }
                                                    }}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                                                />
                                                <div className="w-full bg-black/40 border border-dashed border-white/5 rounded-[1.5rem] px-8 py-6 flex items-center justify-between group-hover/file:border-blue-500/30 transition-all">
                                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{logoFile ? logoFile.name : 'Select JPG/PNG File'}</span>
                                                    <Upload size={18} className="text-gray-700 group-hover/file:text-blue-500 transition-colors" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Preview Block */}
                                    <div className="bg-black/40 border border-white/5 rounded-[2rem] p-10 flex flex-col md:flex-row items-center gap-10">
                                        <div className="w-32 h-32 bg-[#0d0f12] rounded-[1.5rem] flex items-center justify-center border border-white/5 relative overflow-hidden group/preview">
                                            {logoPreview ? (
                                                <Image src={logoPreview} alt="Logo Preview" fill className="object-contain p-4 transition-transform duration-500 group-hover/preview:scale-110" />
                                            ) : (
                                                <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center border border-white/5">
                                                    <Users size={20} className="text-gray-700" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-center md:text-left space-y-2 flex-1">
                                            <h4 className="text-lg font-extrabold uppercase tracking-tight text-white">{teamData.name || 'UNNAMED SQUAD'}</h4>
                                            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest leading-relaxed">Verification of team assets and designation will occur prior to bracket seeding.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Section: Roster */}
                        <section className="bg-[#16191d] border border-white/5 rounded-[3.5rem] p-12 md:p-16 shadow-2xl relative overflow-hidden">
                            <div className="flex items-center justify-between mb-20">
                                <h2 className="text-2xl font-extrabold uppercase tracking-tighter flex items-center gap-4 not-italic">
                                    <ShieldCheck className="text-blue-500" size={28} />
                                    02. Personnel Roster
                                </h2>
                                <span className="text-[10px] font-black text-white/5 uppercase tracking-[0.4em] not-italic">Section Beta</span>
                            </div>

                            <div className="space-y-20 relative z-10">
                                {teamData.players.map((player, i) => (
                                    <div key={i} className="relative pl-16 border-l-2 border-white/5 pb-4 group/player last:pb-0">
                                        {/* Counter */}
                                        <div className="absolute left-[-17px] top-0 w-8 h-8 bg-black border border-white/5 rounded-full flex items-center justify-center font-black text-[10px] text-gray-500 group-hover/player:text-blue-500 group-hover/player:border-blue-500/50 transition-all">
                                            {(i + 1).toString().padStart(2, '0')}
                                        </div>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
                                            <div className="md:col-span-5 space-y-4">
                                                <label className="block text-[9px] font-black text-gray-600 uppercase tracking-[0.3em] flex items-center gap-2">
                                                    <User size={12} className="text-blue-500/50" /> Competitive Handle
                                                </label>
                                                <input 
                                                    type="text"
                                                    required
                                                    value={player.name}
                                                    onChange={(e) => updatePlayer(i, 'name', e.target.value)}
                                                    className="w-full bg-black/40 border border-white/5 rounded-2xl px-6 py-5 text-base font-bold text-white focus:outline-none focus:border-blue-500/30 transition-all placeholder:text-white/5"
                                                    placeholder="In-Game Name..."
                                                />
                                            </div>
                                            <div className="md:col-span-3 space-y-4">
                                                <label className="block text-[9px] font-black text-gray-600 uppercase tracking-[0.3em] flex items-center gap-2">
                                                    <MapPin size={12} className="text-blue-500/50" /> Seat Pos
                                                </label>
                                                <input 
                                                    type="text"
                                                    value={player.seating}
                                                    onChange={(e) => updatePlayer(i, 'seating', e.target.value)}
                                                    className="w-full bg-black/40 border border-white/5 rounded-2xl px-6 py-5 text-base font-bold text-white focus:outline-none focus:border-blue-500/30 transition-all placeholder:text-white/5"
                                                    placeholder="A1, B2..."
                                                />
                                            </div>
                                            <div className="md:col-span-4 space-y-4">
                                                <label className="block text-[9px] font-black text-gray-600 uppercase tracking-[0.3em] flex items-center gap-2">
                                                    <AtSign size={12} className="text-blue-500/50" /> Steam Profile URL
                                                </label>
                                                <input 
                                                    type="text"
                                                    value={player.steamId}
                                                    onChange={(e) => updatePlayer(i, 'steamId', e.target.value)}
                                                    className="w-full bg-black/40 border border-white/5 rounded-2xl px-6 py-5 text-[11px] font-mono text-blue-400 focus:outline-none focus:border-blue-500/30 transition-all placeholder:text-white/5"
                                                    placeholder="https://steamcommunity.com/..."
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 p-8 rounded-[2rem] flex items-center gap-6 text-red-500">
                                <AlertCircle size={24} />
                                <span className="font-extrabold uppercase tracking-widest text-[10px]">{error}</span>
                            </div>
                        )}

                        <button 
                            type="submit"
                            disabled={submitting}
                            className="w-full bg-blue-600 hover:bg-blue-500 py-10 rounded-[2.5rem] font-black uppercase text-[11px] tracking-[0.3em] transition-all disabled:opacity-50 shadow-[0_30px_60px_-15px_rgba(37,99,235,0.4)] flex items-center justify-center gap-6 active:scale-[0.98] group overflow-hidden relative"
                        >
                            <div className="absolute inset-0 bg-white/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                            {submitting ? (
                                <div className="flex items-center gap-4">
                                    <Loader2 className="animate-spin" size={20} />
                                    <span>Syncing Roster...</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-4 relative z-10">
                                    <span>Execute Enrollment Protocol</span>
                                    <ArrowRight size={20} className="group-hover:translate-x-3 transition-transform duration-500" />
                                </div>
                            )}
                        </button>
                    </form>
                </main>

                <footer className="mt-40 text-center pb-20">
                    <div className="bg-white/[0.02] backdrop-blur-3xl border border-white/5 p-12 rounded-[3rem] inline-block relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-30"></div>
                        <div className="flex items-center justify-center gap-10 opacity-20 mb-8 transition-opacity group-hover:opacity-40">
                            <Gamepad2 size={28} />
                            <Users size={28} />
                            <ShieldCheck size={28} />
                            <Trophy size={28} />
                        </div>
                        <p className="text-[10px] font-black text-gray-700 uppercase tracking-[0.6em] mb-2 leading-none not-italic">ApexPlay Tactical Infrastructure</p>
                        <p className="text-[9px] font-bold text-gray-800 uppercase tracking-[0.2em] opacity-50 not-italic">Authorized Personnel Only Beyond This Point</p>
                    </div>
                </footer>
            </div>

            <style jsx global>{`
                ::selection {
                    background: rgba(59, 130, 246, 0.4);
                    color: white;
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 10px;
                }
            `}</style>
        </div>
    );
}
