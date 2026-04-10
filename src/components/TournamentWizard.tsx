'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Check, ChevronRight, ChevronLeft, Trophy, X, Info, Send, Copy, Loader2, Plus, Globe, Settings, Layers, Zap } from 'lucide-react';
import { SUPPORTED_GAMES } from '@/lib/games';

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
        bo5StartRound: '0',
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
        } finally {
            setIsSubmitting(false);
        }
    };

    const copyLink = () => {
        const url = `${window.location.origin}/tournaments/${createdId}`;
        navigator.clipboard.writeText(url);
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 lg:p-12 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-[var(--mds-overlay)] backdrop-blur-sm" onClick={onClose} />
            
            <div className="mds-card w-full max-w-3xl max-h-[90vh] relative z-10 flex flex-col p-0 overflow-hidden shadow-2xl scale-in-center duration-300">
                {/* PROGRESS BAR */}
                <div className="h-1 w-full bg-[var(--mds-input)] border-b border-[var(--mds-border)]">
                    <div
                        className="h-full bg-[var(--mds-action)] transition-all duration-700 ease-in-out shadow-[0_0_8px_var(--mds-action)]"
                        style={{ width: `${(step / 6) * 100}%` }}
                    />
                </div>

                <header className="px-10 py-8 border-b border-[var(--mds-border)] flex items-center justify-between bg-[var(--mds-input)]/20">
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-[var(--mds-action-soft)] text-[var(--mds-action)] border border-[var(--mds-action)]/20">
                            <Plus size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black uppercase tracking-tight">Create Tournament</h2>
                            <p className="mds-uppercase-label text-[9px] mt-0.5 opacity-40">Step {step} of 6</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="mds-btn-secondary h-10 w-10 p-0 flex items-center justify-center"
                    >
                        <X size={18} />
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto p-10 lg:p-12 custom-scrollbar">
                    {/* STEP 1: GAME SELECTION */}
                    {step === 1 && (
                        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div>
                                <h3 className="text-3xl font-black uppercase tracking-tight">Select Game</h3>
                                <p className="mt-2 text-[var(--mds-text-muted)] font-medium leading-relaxed">Choose the game for this tournament cycle.</p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                {SUPPORTED_GAMES.map((game) => (
                                    <button 
                                        key={game.id}
                                        onClick={() => { setFormData({ ...formData, game: game.id, teamSize: String(game.teamSize[game.teamSize.length - 1]) }); nextStep(); }}
                                        className={`group relative h-48 rounded-xl overflow-hidden border-2 transition-all text-left ${formData.game === game.id ? 'border-[var(--mds-action)] bg-[var(--mds-action)]/5' : 'border-[var(--mds-border)] hover:border-[var(--mds-action)]/40'}`}
                                    >
                                        <Image 
                                            src={game.bannerUrl} 
                                            fill 
                                            sizes="400px" 
                                            className="object-cover opacity-10 group-hover:scale-105 group-hover:opacity-20 transition-all duration-700" 
                                            alt="" 
                                        />
                                        <div className="absolute inset-0 p-6 flex flex-col justify-end">
                                            <div className="h-10 w-10 rounded-lg bg-[var(--mds-card)] flex items-center justify-center p-2 mb-4 border border-[var(--mds-border)] shadow-md group-hover:scale-110 transition-transform">
                                                <Image src={game.logoUrl} width={24} height={24} className="object-contain" alt="" />
                                            </div>
                                            <span className="text-lg font-black uppercase tracking-tight text-[var(--mds-text-primary)]">{game.name}</span>
                                            <span className="mds-uppercase-label text-[9px] mt-1 opacity-50">{game.type} Mode</span>
                                        </div>
                                        {formData.game === game.id && (
                                            <div className="absolute top-4 right-4 h-6 w-6 rounded-full bg-[var(--mds-action)] flex items-center justify-center shadow-[0_0_12px_var(--mds-action)]">
                                                <Check size={12} className="text-white" />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* STEP 2: IDENTITY */}
                    {step === 2 && (
                        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div>
                                <h3 className="text-3xl font-black uppercase tracking-tight">Tournament Details</h3>
                                <p className="mt-2 text-[var(--mds-text-muted)] font-medium leading-relaxed">Provide an authoritative name for the competition.</p>
                            </div>
                            <div className="space-y-4">
                                <label className="mds-uppercase-label opacity-40">Tournament Name</label>
                                <input
                                    autoFocus
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    onKeyDown={(e) => e.key === 'Enter' && formData.name && nextStep()}
                                    className="mds-input h-16 text-xl font-bold uppercase tracking-tight bg-[var(--mds-input)]/40 px-6"
                                    placeholder="e.g. Winter Invitational 2024"
                                />
                            </div>
                        </div>
                    )}

                    {/* STEP 3: FORMAT */}
                    {step === 3 && (
                        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div>
                                <h3 className="text-3xl font-black uppercase tracking-tight">Format & Rules</h3>
                                <p className="mt-2 text-[var(--mds-text-muted)] font-medium leading-relaxed">Define the bracket structure and participation limits.</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="space-y-4">
                                    <label className="mds-uppercase-label opacity-40">Bracket Style</label>
                                    <div className="space-y-3">
                                        {[
                                            { id: 'SINGLE_ELIMINATION', name: 'Single Elimination', desc: 'Direct bracket exit on loss' },
                                            { id: 'DOUBLE_ELIMINATION', name: 'Double Elimination', desc: 'Lower bracket second chance' },
                                        ].map(f => (
                                            <button 
                                                key={f.id} 
                                                onClick={() => setFormData({ ...formData, format: f.id })}
                                                className={`w-full p-6 mds-card border-2 text-left transition-all ${formData.format === f.id ? 'border-[var(--mds-action)] bg-[var(--mds-action)]/5' : 'border-[var(--mds-border)] bg-[var(--mds-input)]/20 hover:border-[var(--mds-action)]/30'}`}
                                            >
                                                <div className="font-bold uppercase tracking-tight text-[var(--mds-text-primary)]">{f.name}</div>
                                                <div className="text-[10px] mds-uppercase-label opacity-40 mt-1">{f.desc}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="mds-uppercase-label opacity-40">Team Size</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {selectedGame?.teamSize.map(size => (
                                            <button 
                                                key={size} 
                                                onClick={() => setFormData({ ...formData, teamSize: String(size) })}
                                                className={`p-5 mds-card border-2 text-center transition-all ${formData.teamSize === String(size) ? 'border-[var(--mds-action)] bg-[var(--mds-action)]/5' : 'border-[var(--mds-border)] bg-[var(--mds-input)]/20 hover:border-[var(--mds-action)]/30'}`}
                                            >
                                                <div className="font-bold text-lg uppercase tracking-tighter">{selectedGame.teamSizeLabels?.[size] || `${size}v${size}`}</div>
                                            </button>
                                        ))}
                                    </div>

                                    <div className="mt-8 p-6 mds-card bg-[var(--mds-input)]/20 flex items-center justify-between">
                                        <div>
                                            <div className="font-bold text-[var(--mds-text-primary)] text-sm uppercase tracking-tight">3rd Place Match</div>
                                            <div className="mds-uppercase-label text-[9px] opacity-40 mt-0.5">Determines the bronze medalist</div>
                                        </div>
                                        <button 
                                            onClick={() => setFormData({ ...formData, hasThirdPlace: !formData.hasThirdPlace })}
                                            className={`h-6 w-12 rounded-full relative transition-all duration-300 ${formData.hasThirdPlace ? 'bg-[var(--mds-action)] shadow-[0_0_8px_var(--mds-action)]' : 'bg-gray-700'}`}
                                        >
                                            <div className={`absolute top-1 h-4 w-4 bg-white rounded-full transition-all duration-300 ${formData.hasThirdPlace ? 'left-7' : 'left-1'}`} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 4: SERIES SETTINGS */}
                    {step === 4 && (
                        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div>
                                <h3 className="text-3xl font-black uppercase tracking-tight">Series Rules</h3>
                                <p className="mt-2 text-[var(--mds-text-muted)] font-medium leading-relaxed">Choose the best-of format for each stage of the bracket.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="space-y-4">
                                    <label className="mds-uppercase-label opacity-40">BO3 Start Round</label>
                                    <div className="relative">
                                        <select 
                                            value={formData.bo3StartRound} 
                                            onChange={(e) => setFormData({ ...formData, bo3StartRound: e.target.value })}
                                            className="mds-input h-14 cursor-pointer appearance-none px-6 pr-10 font-bold uppercase tracking-tight"
                                        >
                                            <option value="1">Round 1</option>
                                            <option value="2">Round 2</option>
                                            <option value="3">Round 3</option>
                                            <option value="4">Quarter Finals</option>
                                            <option value="5">Semi Finals</option>
                                            <option value="0">Disabled</option>
                                        </select>
                                        <div className="absolute top-1/2 right-4 -translate-y-1/2 pointer-events-none opacity-40">
                                            <ChevronRight size={16} className="rotate-90" />
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <label className="mds-uppercase-label opacity-40">BO5 Start Round</label>
                                    <div className="relative">
                                        <select 
                                            value={formData.bo5StartRound} 
                                            onChange={(e) => setFormData({ ...formData, bo5StartRound: e.target.value })}
                                            className="mds-input h-14 cursor-pointer appearance-none px-6 pr-10 font-bold uppercase tracking-tight"
                                        >
                                            <option value="0">Disabled</option>
                                            <option value="4">Quarter Finals</option>
                                            <option value="5">Semi Finals</option>
                                            <option value="6">Grand Finals</option>
                                        </select>
                                        <div className="absolute top-1/2 right-4 -translate-y-1/2 pointer-events-none opacity-40">
                                            <ChevronRight size={16} className="rotate-90" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-start gap-4 p-6 mds-card border-[var(--mds-action)]/20 bg-[var(--mds-action-soft)]">
                                <Zap size={18} className="text-[var(--mds-action)] mt-0.5" />
                                <p className="text-xs text-[var(--mds-text-muted)] leading-relaxed font-bold uppercase tracking-tight">
                                    BO5 rules will automatically override BO3 settings for overlapping tournament rounds.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* STEP 5: REVIEW */}
                    {step === 5 && (
                        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div>
                                <h3 className="text-3xl font-black uppercase tracking-tight">Review Setup</h3>
                                <p className="mt-2 text-[var(--mds-text-muted)] font-medium leading-relaxed">Verify all parameters before initializing the tournament.</p>
                            </div>
                            <div className="mds-card bg-[var(--mds-input)]/20 p-8 space-y-8 relative overflow-hidden">
                                <div className="flex items-center gap-6">
                                    <div className="h-20 w-20 rounded-xl border border-[var(--mds-border)] bg-[var(--mds-page)] flex items-center justify-center p-4 shadow-lg">
                                        {selectedGame && <Image src={selectedGame.logoUrl} width={48} height={48} className="object-contain" alt="" />}
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="text-2xl font-black uppercase tracking-tight text-[var(--mds-text-primary)]">{formData.name}</h4>
                                        <div className="mt-2 flex items-center gap-4">
                                            <span className="mds-badge bg-[var(--mds-action-soft)] text-[var(--mds-action)]">{selectedGame?.name}</span>
                                            <span className="mds-badge bg-[var(--mds-input)] border border-[var(--mds-border)] text-[var(--mds-text-subtle)]">{formData.format.replace('_', ' ')}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-8 border-t border-[var(--mds-border)]">
                                    {[
                                        { label: 'Format Style', value: formData.format === 'SINGLE_ELIMINATION' ? 'Single' : 'Double' },
                                        { label: 'Decider Match', value: formData.hasThirdPlace ? 'Active' : 'N/A' },
                                        { label: 'BO3 Stage', value: formData.bo3StartRound === '0' ? 'None' : `Round ${formData.bo3StartRound}` },
                                        { label: 'BO5 Stage', value: formData.bo5StartRound === '0' ? 'None' : `Round ${formData.bo5StartRound}` },
                                    ].map(item => (
                                        <div key={item.label}>
                                            <p className="mds-uppercase-label text-[8px] opacity-40 mb-1.5">{item.label}</p>
                                            <p className="font-bold text-sm uppercase tracking-tight text-[var(--mds-text-primary)]">{item.value}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 6: SUCCESS */}
                    {step === 6 && (
                        <div className="space-y-12 text-center py-10 animate-in fade-in zoom-in-95 duration-700">
                            <div className="h-24 w-24 rounded-full border-2 border-[var(--mds-action)] bg-[var(--mds-action-soft)] flex items-center justify-center mx-auto shadow-lg shadow-[var(--mds-action)]/20">
                                <Trophy size={40} className="text-[var(--mds-action)]" />
                            </div>
                            <div>
                                <h3 className="text-4xl font-black uppercase tracking-tight text-[var(--mds-text-primary)]">Tournament Live</h3>
                                <p className="mt-2 text-[var(--mds-text-muted)] font-medium">Tournament parameters synchronized. Participants may now enroll.</p>
                            </div>

                            <div className="max-w-md mx-auto space-y-6">
                                <div className="mds-card bg-[var(--mds-input)]/40 p-8 text-center border-none shadow-inner">
                                    <p className="mds-uppercase-label text-[9px] mb-4 opacity-40">Registration Link</p>
                                    <div className="flex gap-2">
                                        <div className="flex-1 rounded-lg px-5 py-4 font-mono text-[11px] truncate text-left bg-[var(--mds-page)] border border-[var(--mds-border)] text-[var(--mds-action)] font-bold">
                                            {typeof window !== 'undefined' ? `${window.location.host}/tournaments/${createdId}` : ''}
                                        </div>
                                        <button onClick={copyLink} className="mds-btn-primary h-14 w-14 p-0">
                                            <Copy size={18} />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                                    <button onClick={onClose} className="mds-btn-secondary h-14 px-10 flex-1 uppercase font-black text-xs tracking-widest">
                                        Close
                                    </button>
                                    <button 
                                        onClick={() => window.location.href = `/tournaments/${createdId}`}
                                        className="mds-btn-primary h-14 px-10 flex-1 uppercase font-black text-xs tracking-widest"
                                    >
                                        Tournament Setup
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* FOOTER CONTROLS */}
                {step < 6 && (
                    <div className="px-10 py-8 border-t border-[var(--mds-border)] bg-[var(--mds-input)]/30 backdrop-blur-md flex justify-between items-center shrink-0">
                        <div className="hidden sm:flex items-center gap-3">
                            <span className="mds-uppercase-label text-[9px] opacity-30 tracking-[0.2em]">Step Control //</span>
                            <span className="font-black text-[10px] uppercase tracking-widest">Active Step: {step}</span>
                        </div>

                        <div className="flex gap-4 w-full sm:w-auto">
                            {step > 1 && (
                                <button onClick={prevStep} className="mds-btn-secondary h-12 px-8 text-xs font-black uppercase tracking-widest gap-2 flex-1 sm:flex-initial">
                                    <ChevronLeft size={16} /> Back
                                </button>
                            )}
                            {step < 5 ? (
                                <button
                                    disabled={(step === 1 && !formData.game) || (step === 2 && !formData.name)}
                                    onClick={nextStep}
                                    className="mds-btn-primary h-12 px-10 text-xs font-black uppercase tracking-widest gap-2 flex-1 sm:flex-initial disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    Continue <ChevronRight size={16} />
                                </button>
                            ) : (
                                <button 
                                    disabled={isSubmitting} 
                                    onClick={handleSubmit}
                                    className="mds-btn-primary h-12 px-10 text-xs font-black uppercase tracking-widest gap-2 min-w-[200px] flex-1 sm:flex-initial disabled:opacity-30 shadow-lg shadow-[var(--mds-action)]/20"
                                >
                                    {isSubmitting ? (
                                        <><Loader2 size={16} className="animate-spin" /> Creating...</>
                                    ) : (
                                        <><Trophy size={16} /> Create Tournament</>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
