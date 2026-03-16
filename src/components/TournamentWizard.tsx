'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Trophy, Check, ChevronRight, ChevronLeft, Share2, Copy, Gamepad2, Settings, Send, Layout, X, Info, Users, Calendar, ArrowRight, Loader2, Search } from 'lucide-react';
import { SUPPORTED_GAMES, GameMetadata } from '@/lib/games';

interface TournamentWizardProps {
    onClose: () => void;
    onComplete: (data: any) => Promise<string | void>;
}

export default function TournamentWizard({ onClose, onComplete }: TournamentWizardProps) {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        name: '',
        game: '',
        format: 'SINGLE_ELIMINATION',
        teamSize: '5',
        hasThirdPlace: false,
        bo3StartRound: '1',
        bo5StartRound: '0' // 0 means disabled
    });
    const [createdId, setCreatedId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const selectedGame = SUPPORTED_GAMES.find(g => g.id === formData.game);

    const nextStep = () => setStep(s => Math.min(s + 1, 6));
    const prevStep = () => setStep(s => Math.max(s - 1, 1));

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            const id = await onComplete(formData);
            if (id) {
                setCreatedId(id);
                setStep(6);
            }
        } catch (error) {
            console.error('Wizard submission failed:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const copyLink = () => {
        const url = `${window.location.origin}/tournaments/${createdId}`;
        navigator.clipboard.writeText(url);
        // Simple visual feedback could be added here
    };

    return (
        <div className="fixed inset-0 bg-[#07080a]/95 backdrop-blur-2xl flex items-center justify-center z-[100] p-4 md:p-8">
            <div className="bg-[#111418] border border-white/5 w-full max-w-4xl rounded-[3rem] shadow-[0_0_100px_rgba(37,99,235,0.1)] overflow-hidden relative flex flex-col max-h-[90vh]">
                {/* Progress Bar */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-white/5">
                    <div 
                        className="h-full bg-blue-600 transition-all duration-500 ease-out"
                        style={{ width: `${(step / 6) * 100}%` }}
                    ></div>
                </div>

                {/* Close Button */}
                <button 
                    onClick={onClose}
                    className="absolute top-8 right-8 w-12 h-12 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/5 z-20 group"
                >
                    <X size={20} className="text-gray-400 group-hover:rotate-90 transition-transform duration-300" />
                </button>

                {/* Step Content */}
                <div className="flex-1 overflow-y-auto p-8 md:p-16 custom-scrollbar">
                    {/* Step 1: Game Selection */}
                    {step === 1 && (
                        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div>
                                <h2 className="text-4xl font-black uppercase tracking-tighter mb-4">Choose your <span className="text-blue-500">Battlefield</span></h2>
                                <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Select the game for this tournament series</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {SUPPORTED_GAMES.map((game) => (
                                    <button
                                        key={game.id}
                                        onClick={() => {
                                            setFormData({ 
                                                ...formData, 
                                                game: game.id,
                                                teamSize: String(game.teamSize[game.teamSize.length - 1])
                                            });
                                            nextStep();
                                        }}
                                        className={`group relative h-48 rounded-[2rem] overflow-hidden border transition-all ${formData.game === game.id ? 'border-blue-500 shadow-lg shadow-blue-500/20' : 'border-white/5 hover:border-white/20'}`}
                                    >
                                        <div className="absolute inset-0">
                                            <Image 
                                              src={game.bannerUrl} 
                                              fill 
                                              priority={SUPPORTED_GAMES.indexOf(game) < 4}
                                              sizes="(max-width: 768px) 100vw, 400px"
                                              className="object-cover brightness-[0.4] group-hover:scale-110 transition-transform duration-700" 
                                              alt={game.name} 
                                            />
                                        </div>
                                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent"></div>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                                            <div className="w-16 h-16 mb-4 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 flex items-center justify-center p-3 group-hover:scale-110 transition-transform duration-500 relative">
                                                <Image 
                                                    src={game.logoUrl} 
                                                    width={40} 
                                                    height={40} 
                                                    className="object-contain" 
                                                    alt="" 
                                                    sizes="40px"
                                                />
                                            </div>
                                            <h3 className="text-xl font-black uppercase tracking-tighter">{game.name}</h3>
                                        </div>
                                        {formData.game === game.id && (
                                            <div className="absolute top-4 right-4 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                                                <Check size={16} />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 2: Name */}
                    {step === 2 && (
                        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div>
                                <h2 className="text-4xl font-black uppercase tracking-tighter mb-4">Name your <span className="text-blue-500">Glory</span></h2>
                                <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">A memorable title for your competition</p>
                            </div>
                            <div className="space-y-4">
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest pl-2">Tournament Title</label>
                                <input
                                    autoFocus
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    onKeyDown={(e) => e.key === 'Enter' && formData.name && nextStep()}
                                    className="w-full bg-black border border-white/5 rounded-3xl px-8 py-8 text-3xl font-black text-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-white/5"
                                    placeholder="Enter Tournament Name..."
                                />
                            </div>
                        </div>
                    )}

                    {/* Step 3: Settings */}
                    {step === 3 && (
                        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div>
                                <h2 className="text-4xl font-black uppercase tracking-tighter mb-4">Refine the <span className="text-blue-500">Rules</span></h2>
                                <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Configure the competition structure</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest pl-2">Brackets Layout</label>
                                    <div className="grid grid-cols-1 gap-3">
                                        {[
                                            { id: 'SINGLE_ELIMINATION', name: 'Single Elimination', desc: 'One loss and you are out' },
                                            { id: 'DOUBLE_ELIMINATION', name: 'Double Elimination', desc: 'Second chance in lower bracket' }
                                        ].map(f => (
                                            <button
                                                key={f.id}
                                                onClick={() => setFormData({ ...formData, format: f.id })}
                                                className={`p-6 rounded-2xl border text-left transition-all ${formData.format === f.id ? 'bg-blue-600/10 border-blue-500/50' : 'bg-black/40 border-white/5 hover:border-white/10'}`}
                                            >
                                                <div className="font-extrabold uppercase tracking-tight text-sm mb-1">{f.name}</div>
                                                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{f.desc}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest pl-2">Combat Size</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {selectedGame?.teamSize.map(size => (
                                            <button
                                                key={size}
                                                onClick={() => setFormData({ ...formData, teamSize: String(size) })}
                                                className={`p-6 rounded-2xl border text-center transition-all ${formData.teamSize === String(size) ? 'bg-blue-600/10 border-blue-500/50' : 'bg-black/40 border-white/5 hover:border-white/10'}`}
                                            >
                                                <div className="text-xl font-black uppercase">{selectedGame.teamSizeLabels?.[size] || `${size}v${size}`}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="md:col-span-2 p-8 bg-black/40 border border-white/5 rounded-3xl flex items-center justify-between">
                                    <div className="space-y-1">
                                        <div className="font-extrabold uppercase tracking-tight">Decider Match</div>
                                        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Enable 3rd Place Playoff</div>
                                    </div>
                                    <button
                                        onClick={() => setFormData({ ...formData, hasThirdPlace: !formData.hasThirdPlace })}
                                        className={`w-16 h-8 rounded-full transition-all relative ${formData.hasThirdPlace ? 'bg-blue-600' : 'bg-white/10'}`}
                                    >
                                        <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${formData.hasThirdPlace ? 'left-9' : 'left-1'}`}></div>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Series Rules */}
                    {step === 4 && (
                        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div>
                                <h2 className="text-4xl font-black uppercase tracking-tighter mb-4">Series <span className="text-blue-500">Thresholds</span></h2>
                                <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Define when high-stakes series begin</p>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest pl-2">Start BO3 From Round</label>
                                    <select
                                        value={formData.bo3StartRound}
                                        onChange={(e) => setFormData({ ...formData, bo3StartRound: e.target.value })}
                                        className="w-full bg-black border border-white/5 rounded-2xl px-6 py-5 text-white focus:outline-none focus:border-blue-500 transition-all font-bold appearance-none cursor-pointer"
                                    >
                                        <option value="1">Round 1 (All matches BO3)</option>
                                        <option value="2">Round 2 onwards</option>
                                        <option value="3">Round 3 onwards</option>
                                        <option value="4">Quarter Finals onwards</option>
                                        <option value="5">Semi Finals onwards</option>
                                        <option value="0">Disabled (All BO1)</option>
                                    </select>
                                </div>

                                <div className="space-y-4">
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest pl-2">Start BO5 From Round</label>
                                    <select
                                        value={formData.bo5StartRound}
                                        onChange={(e) => setFormData({ ...formData, bo5StartRound: e.target.value })}
                                        className="w-full bg-black border border-white/5 rounded-2xl px-6 py-5 text-white focus:outline-none focus:border-blue-500 transition-all font-bold appearance-none cursor-pointer"
                                    >
                                        <option value="0">Disabled (No BO5)</option>
                                        <option value="4">Quarter Finals only</option>
                                        <option value="5">Semi Finals onwards</option>
                                        <option value="6">Grand Finals only</option>
                                    </select>
                                </div>

                                <div className="md:col-span-2 p-8 bg-blue-600/5 border border-blue-500/10 rounded-3xl">
                                    <div className="flex gap-4 items-start">
                                        <Info className="text-blue-500 shrink-0 mt-0.5" size={18} />
                                        <div className="space-y-1">
                                            <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Format Priority</div>
                                            <p className="text-xs text-gray-500 leading-relaxed font-bold">BO5 setting overrides BO3 for overlapping rounds. Lower rounds remain BO1 unless covered by BO3 settings.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 5: Confirmation */}
                    {step === 5 && (
                        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div>
                                <h2 className="text-4xl font-black uppercase tracking-tighter mb-4">Execute <span className="text-blue-500">Directives</span></h2>
                                <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Review and initialize your tournament</p>
                            </div>
                            <div className="bg-black/40 border border-white/5 rounded-[2.5rem] p-10 space-y-8 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 blur-[80px] rounded-full -mr-32 -mt-32"></div>
                                
                                <div className="flex items-start gap-8 relative z-10">
                                    <div className="w-24 h-24 bg-white/5 backdrop-blur-2xl rounded-[1.5rem] border border-white/10 flex items-center justify-center p-4 relative">
                                        <Image 
                                            src={selectedGame?.logoUrl || ''} 
                                            width={64} 
                                            height={64} 
                                            className="object-contain" 
                                            alt="" 
                                            sizes="64px"
                                        />
                                    </div>
                                    <div className="flex-1 space-y-4">
                                        <h3 className="text-3xl font-black uppercase tracking-tighter leading-none">{formData.name}</h3>
                                        <div className="flex flex-wrap gap-3">
                                            <span className="bg-blue-600/10 text-blue-500 border border-blue-500/20 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">{selectedGame?.name}</span>
                                            <span className="bg-white/5 text-gray-400 border border-white/5 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">{formData.format.replace('_', ' ')}</span>
                                            <span className="bg-white/5 text-gray-400 border border-white/5 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
                                                {selectedGame?.teamSizeLabels?.[Number(formData.teamSize)] || `${formData.teamSize}v${formData.teamSize}`}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                 <div className="pt-8 border-t border-white/5 grid grid-cols-2 md:grid-cols-4 gap-6 relative z-10">
                                    <div className="space-y-1 text-center">
                                        <div className="text-[10px] text-gray-600 font-black uppercase tracking-widest">Structure</div>
                                        <div className="text-sm font-extrabold uppercase tracking-tight">{formData.format === 'SINGLE_ELIMINATION' ? 'Single' : 'Double'}</div>
                                    </div>
                                    <div className="space-y-1 text-center">
                                        <div className="text-[10px] text-gray-600 font-black uppercase tracking-widest">3rd Place</div>
                                        <div className="text-sm font-extrabold uppercase tracking-tight text-blue-500">{formData.hasThirdPlace ? 'ON' : 'OFF'}</div>
                                    </div>
                                    <div className="space-y-1 text-center">
                                        <div className="text-[10px] text-gray-600 font-black uppercase tracking-widest">BO3 Start</div>
                                        <div className="text-sm font-extrabold uppercase tracking-tight">{formData.bo3StartRound === '0' ? 'N/A' : `R${formData.bo3StartRound}`}</div>
                                    </div>
                                    <div className="space-y-1 text-center">
                                        <div className="text-[10px] text-gray-600 font-black uppercase tracking-widest">BO5 Start</div>
                                        <div className="text-sm font-extrabold uppercase tracking-tight">{formData.bo5StartRound === '0' ? 'N/A' : `R${formData.bo5StartRound}`}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 6: Completion */}
                    {step === 6 && (
                        <div className="space-y-10 text-center py-10 animate-in fade-in zoom-in-95 duration-700">
                            <div className="w-32 h-32 bg-green-500/10 border border-green-500/20 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 animate-bounce">
                                <Trophy size={48} className="text-green-500" />
                            </div>
                            <div className="space-y-4">
                                <h2 className="text-5xl font-black uppercase tracking-tighter">System <span className="text-green-500">Operational</span></h2>
                                <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Tournament successfully initialized in the network</p>
                            </div>
                            
                            <div className="max-w-md mx-auto space-y-6 pt-10">
                                <div className="bg-black/40 border border-white/5 rounded-3xl p-8 space-y-4">
                                    <div className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Shareable Registration Link</div>
                                    <div className="flex gap-3">
                                        <div className="flex-1 bg-black border border-white/5 rounded-2xl px-6 py-4 text-left font-mono text-[10px] text-blue-400 truncate">
                                            {typeof window !== 'undefined' ? `${window.location.origin}/tournaments/${createdId}/register` : ''}
                                        </div>
                                        <button 
                                            onClick={copyLink}
                                            className="w-14 h-14 bg-blue-600 hover:bg-blue-500 rounded-2xl flex items-center justify-center transition-all shadow-lg shadow-blue-600/20 active:scale-90 group"
                                        >
                                            <Copy size={20} className="group-hover:scale-110 transition-transform" />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <button
                                        onClick={onClose}
                                        className="flex-1 bg-white/5 hover:bg-white/10 py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all border border-white/5 active:scale-95"
                                    >
                                        Close Console
                                    </button>
                                    <button
                                        onClick={() => window.location.href = `/dashboard/tournaments/${createdId}`}
                                        className="flex-[1.5] bg-blue-600 hover:bg-blue-500 py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all shadow-xl shadow-blue-600/20 active:scale-95 text-white"
                                    >
                                        Enter Management
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                {step < 6 && (
                    <div className="p-8 md:p-12 border-t border-white/5 bg-[#111418]/80 backdrop-blur-xl flex justify-between items-center relative z-10">
                        <div className="flex items-center gap-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                            <span className="text-blue-500">Step {step}</span>
                            <span className="opacity-20">/</span>
                            <span>6</span>
                        </div>
                        
                        <div className="flex gap-4">
                            {step > 1 && (
                                <button
                                    onClick={prevStep}
                                    className="px-8 py-4 rounded-2xl bg-white/5 font-black text-[10px] tracking-widest text-gray-500 hover:text-white transition-all uppercase flex items-center gap-2 border border-white/5"
                                >
                                    <ChevronLeft size={16} /> Back
                                </button>
                            )}
                            {step < 5 ? (
                                <button
                                    disabled={step === 1 && !formData.game || step === 2 && !formData.name}
                                    onClick={nextStep}
                                    className="bg-blue-600 hover:bg-blue-500 px-10 py-4 rounded-2xl font-black text-[10px] tracking-widest text-white transition-all shadow-lg shadow-blue-600/20 active:scale-95 uppercase flex items-center gap-2 disabled:opacity-20"
                                >
                                    Proceed <ChevronRight size={16} />
                                </button>
                            ) : (
                                <button
                                    disabled={isSubmitting}
                                    onClick={handleSubmit}
                                    className="bg-green-600 hover:bg-green-500 px-12 py-4 rounded-2xl font-black text-[10px] tracking-widest text-white transition-all shadow-lg shadow-green-600/20 active:scale-95 uppercase flex items-center gap-2 disabled:opacity-20"
                                >
                                    {isSubmitting ? 'Initializing...' : 'Initialize Tournament'} <Send size={16} />
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <style jsx global>{`
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
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(59, 130, 246, 0.2);
                }
            `}</style>
        </div>
    );
}
