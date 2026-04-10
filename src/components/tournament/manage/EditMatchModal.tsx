'use client';

import React, { useState } from 'react';
import { X, Sword, Save, RefreshCw, Send, CheckCircle2, History, Map, Globe, ShieldCheck, Trophy, Activity, Play } from 'lucide-react';

interface EditMatchModalProps {
  match: any;
  onClose: () => void;
  matchForm: any;
  setMatchForm: (form: any) => void;
  onSaveMatch: (e: React.FormEvent) => void;
  onAnnounceDiscord: (match: any, type: 'START' | 'RESULT') => void;
  onLoadMatch: (matchId: string) => Promise<void>;
  isSaving: boolean;
  isLoadingMatch: boolean;
}

export const EditMatchModal: React.FC<EditMatchModalProps> = ({
  match,
  onClose,
  matchForm,
  setMatchForm,
  onSaveMatch,
  onAnnounceDiscord,
  onLoadMatch,
  isSaving,
  isLoadingMatch
}) => {
  const [announcing, setAnnouncing] = useState(false);

  const handleAnnounce = async (type: 'START' | 'RESULT') => {
    setAnnouncing(true);
    try {
      await onAnnounceDiscord(match, type);
    } finally {
      setAnnouncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-[var(--mds-overlay)] backdrop-blur-md" onClick={onClose}></div>
      <div className="mds-card w-full max-w-3xl p-0 relative z-10 flex flex-col overflow-hidden shadow-2xl scale-in-center duration-300 border-[var(--mds-action)]/20 hover:border-[var(--mds-action)]/40 transition-all">
        <header className="px-10 py-10 border-b border-[var(--mds-border)] bg-[var(--mds-input)]/20 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="h-14 w-14 rounded-xl bg-[var(--mds-red)]/10 text-[var(--mds-red)] border border-[var(--mds-red)]/20 flex items-center justify-center shadow-lg">
                <Sword size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight">Match Controls</h2>
              <div className="flex items-center gap-3 mt-1.5 opacity-40 text-[9px] font-black uppercase tracking-[0.2em]">
                <ShieldCheck size={12} /> Match ID: {match.id.split('-')[0].toUpperCase()}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="mds-btn-secondary h-12 w-12 p-0 flex items-center justify-center rounded-xl bg-[var(--mds-input)] border border-[var(--mds-border)] shadow-sm active:scale-95 transition-all">
            <X size={20} />
          </button>
        </header>
        
        <form onSubmit={onSaveMatch} className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar">
          {/* STATUS SELECTOR */}
          <div className="space-y-4">
            <label className="mds-uppercase-label">Match Status</label>
            <div className="grid grid-cols-3 gap-3">
                {[
                    { id: 'READY', label: 'Ready', color: 'var(--mds-text-muted)', icon: History },
                    { id: 'LIVE', label: 'Live', color: 'var(--mds-red)', icon: Activity },
                    { id: 'COMPLETED', label: 'Final', color: 'var(--mds-green)', icon: CheckCircle2 }
                ].map((s) => (
                    <button
                        key={s.id}
                        type="button"
                        onClick={() => setMatchForm({...matchForm, status: s.id})}
                        className={`flex items-center justify-center p-4 rounded-lg border-2 transition-all gap-3 ${
                            matchForm.status === s.id 
                                ? 'bg-[var(--mds-action-soft)] border-[var(--mds-action)] text-[var(--mds-text-primary)]' 
                                : 'bg-[var(--mds-input)] border-[var(--mds-border)] text-[var(--mds-text-muted)] hover:border-[var(--mds-border-hover)]'
                        }`}
                    >
                        <s.icon size={16} style={{ color: matchForm.status === s.id ? s.color : 'inherit' }} />
                        <span className="text-[11px] font-bold uppercase tracking-wider">{s.label}</span>
                    </button>
                ))}
            </div>
          </div>

          {/* SCORE INPUT */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6 bg-[var(--mds-input)]/40 p-8 rounded-xl border border-[var(--mds-border)] shadow-inner">
            <div className="space-y-4 text-center">
              <label className="mds-uppercase-label text-[9px]">Home Team</label>
              <div className="text-sm font-black uppercase truncate text-[var(--mds-text-primary)]">{match.homeTeam?.name || 'TBD'}</div>
              <input 
                type="number" 
                value={matchForm.homeScore} 
                onChange={(e) => setMatchForm({...matchForm, homeScore: parseInt(e.target.value) || 0})}
                className="mds-input text-center h-16 text-3xl font-black tabular-nums"
              />
            </div>
            
            <div className="text-2xl font-black text-[var(--mds-border)] mt-8">VS</div>
            
            <div className="space-y-4 text-center">
              <label className="mds-uppercase-label text-[9px]">Away Team</label>
              <div className="text-sm font-black uppercase truncate text-[var(--mds-text-primary)]">{match.awayTeam?.name || 'TBD'}</div>
              <input 
                type="number" 
                value={matchForm.awayScore} 
                onChange={(e) => setMatchForm({...matchForm, awayScore: parseInt(e.target.value) || 0})}
                className="mds-input text-center h-16 text-3xl font-black tabular-nums"
              />
            </div>
          </div>

          {/* MAP SCORES (Conditional) */}
          {matchForm.bestOf > 1 && (
            <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                <label className="mds-uppercase-label">Series Map Progression</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[...Array(matchForm.bestOf)].map((_, i) => {
                        const score = (matchForm.mapScores || [])[i] || { home: 0, away: 0, map: '' };
                        return (
                            <div key={i} className="p-4 rounded-lg bg-[var(--mds-input)] border border-[var(--mds-border)] space-y-3">
                                <span className="text-[9px] font-bold text-[var(--mds-text-subtle)] uppercase tracking-widest">MAP {i + 1}</span>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="number" 
                                        value={score.home}
                                        onChange={(e) => {
                                            const newScores = [...(matchForm.mapScores || [])];
                                            newScores[i] = { ...score, home: parseInt(e.target.value) || 0 };
                                            setMatchForm({ ...matchForm, mapScores: newScores });
                                        }}
                                        className="w-full h-8 bg-black border border-[var(--mds-border)] text-center font-mono font-bold text-xs rounded"
                                    />
                                    <span className="opacity-20 font-bold text-[10px]">:</span>
                                    <input 
                                        type="number" 
                                        value={score.away}
                                        onChange={(e) => {
                                            const newScores = [...(matchForm.mapScores || [])];
                                            newScores[i] = { ...score, away: parseInt(e.target.value) || 0 };
                                            setMatchForm({ ...matchForm, mapScores: newScores });
                                        }}
                                        className="w-full h-8 bg-black border border-[var(--mds-border)] text-center font-mono font-bold text-xs rounded"
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
          )}

          {/* SETTINGS & ACTIONS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
                <label className="mds-uppercase-label">Series Configuration</label>
                <select 
                    value={matchForm.bestOf}
                    onChange={(e) => setMatchForm({...matchForm, bestOf: parseInt(e.target.value)})}
                    className="mds-input h-12 text-[11px] font-bold uppercase tracking-wider"
                >
                    <option value={1}>Best of 1 (BO1)</option>
                    <option value={3}>Best of 3 (BO3)</option>
                    <option value={5}>Best of 5 (BO5)</option>
                </select>
            </div>
            <div className="space-y-4">
                <label className="mds-uppercase-label">Match Actions</label>
                <div className="flex flex-wrap gap-3">
                    <button 
                        type="button"
                        onClick={() => onLoadMatch(match.id)}
                        disabled={isLoadingMatch}
                        data-testid="start-match-button"
                        className="flex-1 h-12 rounded-lg border border-[var(--mds-action)]/30 hover:border-[var(--mds-action)] hover:bg-[var(--mds-action)]/10 text-[var(--mds-action)] transition-all flex items-center justify-center gap-2 group disabled:opacity-50 min-w-[160px]"
                    >
                        {isLoadingMatch ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
                        <span className="text-[10px] font-black uppercase tracking-wider">Start Match</span>
                    </button>
                    <button 
                        type="button"
                        onClick={() => handleAnnounce('START')}
                        disabled={announcing}
                        data-testid="notify-players-button"
                        className="flex-1 h-12 rounded-lg border border-[#5865F2]/30 hover:border-[#5865F2] hover:bg-[#5865F2]/10 text-[#5865F2] transition-all flex items-center justify-center gap-2 group disabled:opacity-50 min-w-[140px]"
                    >
                        <Send size={14} className="group-hover:translate-x-0.5 transition-transform" /> 
                        <span className="text-[10px] font-black uppercase tracking-wider">Notify Players</span>
                    </button>
                    <button 
                        type="button"
                        onClick={() => handleAnnounce('RESULT')}
                        disabled={announcing}
                        className="flex-1 h-12 rounded-lg border border-[var(--mds-green)]/30 hover:border-[var(--mds-green)] hover:bg-[var(--mds-green)]/10 text-[var(--mds-green)] transition-all flex items-center justify-center gap-2 group disabled:opacity-50 min-w-[140px]"
                    >
                        <Trophy size={14} /> 
                        <span className="text-[10px] font-black uppercase tracking-wider">Send Result</span>
                    </button>
                </div>
            </div>
          </div>

          <div className="pt-4">
            <button 
                type="submit" 
                disabled={isSaving}
                className="mds-btn-primary w-full h-14 text-[11px] font-black uppercase tracking-[0.15em] shadow-lg shadow-[var(--mds-action)]/20"
            >
                {isSaving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                Update Match Data
            </button>
          </div>
        </form>

        <footer className="px-10 py-6 border-t border-[var(--mds-border)] bg-[var(--mds-input)]/10 flex items-center justify-between">
            <div className="flex items-center gap-6 text-[9px] font-bold text-[var(--mds-text-subtle)] uppercase tracking-widest">
                <div className="flex items-center gap-2"><Map size={12} /> Match data synced</div>
                <div className="flex items-center gap-2"><History size={12} /> Ready for updates</div>
            </div>
            <div className="flex items-center gap-2 text-[9px] font-bold text-[var(--mds-text-subtle)] uppercase tracking-widest">
                <Globe size={12} /> Tournament view
            </div>
        </footer>
      </div>
    </div>
  );
};
