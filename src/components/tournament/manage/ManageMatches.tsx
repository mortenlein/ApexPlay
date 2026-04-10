'use client';

import React from 'react';
import { Sword, Filter, Zap, RefreshCw, Gamepad2, Settings2, CheckCircle2, AlertCircle } from 'lucide-react';

interface ManageMatchesProps {
  matches: any[];
  onGenerateMatches: () => void;
  generating: boolean;
  onOpenMatchModal: (match: any) => void;
  teamsCount: number;
}

export const ManageMatches: React.FC<ManageMatchesProps> = ({
  matches,
  onGenerateMatches,
  generating,
  onOpenMatchModal,
  teamsCount
}) => {
  const completedMatches = matches.filter(m => m.status === 'COMPLETED').length;
  const liveMatches = matches.filter(m => m.status === 'LIVE' || m.status === 'IN_PROGRESS').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <section className="bg-[var(--mds-card)] border border-[var(--mds-border)] rounded-xl overflow-hidden shadow-xl">
        <header className="px-8 py-6 border-b border-[var(--mds-border)] bg-[var(--mds-input)]/20 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="h-12 w-12 rounded-lg bg-[var(--mds-action-soft)] text-[var(--mds-action)] border border-[var(--mds-action)]/20 flex items-center justify-center shadow-sm">
                <Sword size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">Tournament Matches</h2>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[10px] font-bold text-[var(--mds-green)] uppercase tracking-wider">{completedMatches} COMPLETED</span>
                <span className="h-1 w-1 rounded-full bg-[var(--mds-border)]" />
                <span className="text-[10px] font-bold text-[var(--mds-red)] uppercase tracking-wider">{liveMatches} LIVE</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="mds-btn-secondary h-10 px-4 text-[11px] font-bold uppercase tracking-wider gap-2">
              <Filter size={14} /> Filter
            </button>
            <button 
                onClick={onGenerateMatches}
                disabled={generating || teamsCount < 2 || matches.length > 0}
                className="mds-btn-primary h-10 px-6 text-[11px] font-bold uppercase tracking-wider gap-2 disabled:opacity-30"
            >
                {generating ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
                Deploy Brackets
            </button>
          </div>
        </header>

        <div className="p-8">
          {matches.length === 0 ? (
            <div className="py-32 text-center border border-dashed border-[var(--mds-border)] rounded-xl bg-[var(--mds-input)]/5">
              <div className="h-16 w-16 rounded-full bg-[var(--mds-input)] border border-[var(--mds-border)] flex items-center justify-center mx-auto mb-6">
                <Gamepad2 size={32} className="text-[var(--mds-text-subtle)]" />
              </div>
              <h3 className="text-lg font-bold uppercase tracking-tight text-[var(--mds-text-primary)]">Initialization Required</h3>
              <p className="mt-2 text-[var(--mds-text-muted)] text-sm max-w-sm mx-auto leading-relaxed">
                Brackets have not been deployed yet. Register at least 2 teams to enable the deployment sequence.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {matches.map((m: any) => (
                <button 
                  key={m.id} 
                  onClick={() => onOpenMatchModal(m)}
                  data-testid={`match-card-${m.id}`}
                  className={`group relative flex flex-col transition-all text-left overflow-hidden rounded-xl border bg-[var(--mds-input)]/20 hover:bg-[var(--mds-card)] hover:shadow-2xl ${
                    m.status === 'LIVE' 
                      ? 'border-[var(--mds-red)]/40 shadow-[0_0_15px_rgba(255,23,68,0.1)]' 
                      : 'border-[var(--mds-border)] hover:border-[var(--mds-action)]/40'
                  }`}
                >
                  <div className="px-5 py-3 border-b border-[var(--mds-border)]/50 bg-[var(--mds-card)]/30 flex items-center justify-between">
                    <span className="text-[9px] font-bold text-[var(--mds-text-subtle)] uppercase tracking-widest">
                        MATCH {m.id.split('-')[0].toUpperCase()}
                    </span>
                    <div className="flex items-center gap-2">
                        {m.status === 'COMPLETED' ? (
                            <span className="text-[9px] font-black text-[var(--mds-green)] uppercase tracking-wider">FINAL</span>
                        ) : m.status === 'LIVE' ? (
                            <div className="flex items-center gap-1.5 text-[var(--mds-red)] animate-pulse">
                                <div className="h-1.5 w-1.5 rounded-full bg-current" />
                                <span className="text-[9px] font-black uppercase tracking-wider">LIVE</span>
                            </div>
                        ) : (
                            <span className="text-[9px] font-bold text-[var(--mds-text-subtle)] uppercase tracking-wider">
                                {String(m.status || 'READY').replaceAll('_', ' ')}
                            </span>
                        )}
                    </div>
                  </div>
                  
                  <div className="p-6 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className={`text-sm font-black uppercase truncate transition-colors ${m.status === 'COMPLETED' && m.homeScore > m.awayScore ? 'text-[var(--mds-text-primary)]' : 'text-[var(--mds-text-muted)] group-hover:text-[var(--mds-text-primary)]'}`}>
                            {m.homeTeam?.name || 'TBD'}
                        </span>
                        <span className={`font-mono text-xl font-black tabular-nums transition-all ${m.status === 'COMPLETED' && m.homeScore > m.awayScore ? 'text-[var(--mds-action)]' : 'opacity-30'}`}>{m.homeScore}</span>
                      </div>
                      <div className="h-px w-full bg-[var(--mds-border)]/30" />
                      <div className="flex items-center justify-between gap-3">
                        <span className={`text-sm font-black uppercase truncate transition-colors ${m.status === 'COMPLETED' && m.awayScore > m.homeScore ? 'text-[var(--mds-text-primary)]' : 'text-[var(--mds-text-muted)] group-hover:text-[var(--mds-text-primary)]'}`}>
                            {m.awayTeam?.name || 'TBD'}
                        </span>
                        <span className={`font-mono text-xl font-black tabular-nums transition-all ${m.status === 'COMPLETED' && m.awayScore > m.homeScore ? 'text-[var(--mds-action)]' : 'opacity-30'}`}>{m.awayScore}</span>
                      </div>
                    </div>
                    
                    <div className="h-10 w-10 rounded-lg bg-[var(--mds-input)] border border-[var(--mds-border)] flex items-center justify-center text-[var(--mds-action)] opacity-0 group-hover:opacity-100 transition-all shadow-lg group-hover:bg-[var(--mds-action-soft)]">
                        <Settings2 size={18} />
                    </div>
                  </div>
                  
                  <div className="px-5 py-3 mt-auto bg-[var(--mds-card)]/50 border-t border-[var(--mds-border)] flex items-center justify-between">
                    <div className="flex flex-col">
                        <span className="text-[9px] font-black text-[var(--mds-action)] uppercase tracking-widest">Round {m.round}</span>
                        <span className="text-[8px] font-medium text-[var(--mds-text-subtle)] uppercase tracking-wider">{m.bracketType || 'Winners'} Bracket</span>
                    </div>
                    {m.bestOf > 1 && (
                        <span className="text-[9px] font-bold text-[var(--mds-amber)] uppercase bg-[var(--mds-amber)]/10 px-2 py-0.5 rounded border border-[var(--mds-amber)]/20">BO{m.bestOf}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
