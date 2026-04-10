'use client';

import React from 'react';
import Image from 'next/image';
import { X, Users, UserPlus, Trash2, Globe, ShieldCheck, Mail, Hash } from 'lucide-react';

interface EditTeamModalProps {
  team: any;
  onClose: () => void;
  onDeletePlayer: (playerId: string) => void;
}

export const EditTeamModal: React.FC<EditTeamModalProps> = ({
  team,
  onClose,
  onDeletePlayer
}) => {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-[var(--mds-overlay)] backdrop-blur-md" onClick={onClose}></div>
      <div className="mds-card w-full max-w-4xl max-h-[90vh] p-0 relative z-10 flex flex-col overflow-hidden shadow-2xl scale-in-center duration-300 border-[var(--mds-action)]/20">
        <header className="px-10 py-10 border-b border-[var(--mds-border)] flex items-start justify-between bg-[var(--mds-input)]/20">
          <div className="flex items-center gap-10">
            <div className="h-24 w-24 bg-[var(--mds-page)] rounded-xl border border-[var(--mds-border)] flex items-center justify-center p-4 shadow-lg shrink-0 group transition-all hover:border-[var(--mds-action)]/30">
              {team.logoUrl ? (
                <Image src={team.logoUrl} fill alt="" className="object-contain p-2 grayscale brightness-125" />
              ) : (
                <Users size={40} className="text-[var(--mds-action)]" />
              )}
            </div>
            <div>
              <h2 className="text-4xl font-black uppercase tracking-tight text-[var(--mds-text-primary)] leading-[0.9] mb-4">{team.name}</h2>
              <div className="flex items-center gap-4">
                <span className="mds-badge bg-[var(--mds-action-soft)] text-[var(--mds-action)] font-black uppercase text-[10px] tracking-widest border-[var(--mds-action)]/20 px-4 py-1.5 shadow-sm">
                  Seed: {team.seed || 'Unranked'}
                </span>
                <span className="mds-uppercase-label text-[9px] opacity-40 uppercase tracking-[0.2em] font-black">Team ID: {team.id.split('-')[0].toUpperCase()}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="mds-btn-secondary h-12 w-12 p-0 flex items-center justify-center rounded-xl bg-[var(--mds-input)] border border-[var(--mds-border)] shadow-sm active:scale-95 transition-all">
            <X size={20} />
          </button>
        </header>
        
        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
          <div className="flex items-center justify-between mb-10 border-b border-[var(--mds-border)] pb-8">
            <div className="flex items-center gap-4">
                <ShieldCheck size={20} className="text-[var(--mds-action)]" />
                <h3 className="text-xl font-black uppercase tracking-tight">Active Roster ({team.players?.length || 0})</h3>
            </div>
            <button className="mds-btn-primary h-10 px-6 text-[10px] font-black uppercase tracking-widest gap-2 shadow-lg shadow-[var(--mds-action)]/20">
              <UserPlus size={14} /> Add Player
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {team.players?.map((p: any, idx: number) => {
              const discordAccount = p.user?.accounts?.find((a: any) => a.provider === 'discord');
              return (
                <div key={idx} className="mds-card bg-[var(--mds-input)]/20 p-8 flex items-center justify-between group hover:border-[var(--mds-action)]/30 transition-all shadow-md">
                  <div className="flex items-center gap-6 min-w-0">
                    <div className="h-12 w-12 bg-[var(--mds-page)] rounded-xl border border-[var(--mds-border)] flex items-center justify-center text-[var(--mds-action)] font-mono font-black text-xs shadow-inner shrink-0 group-hover:border-[var(--mds-action)]/40 transition-all">
                      {(idx + 1).toString().padStart(2, '0')}
                    </div>
                    <div className="truncate">
                      <p className="text-lg font-black uppercase tracking-tight text-[var(--mds-text-primary)] truncate flex items-center gap-2">
                        {p.nickname || p.name.split(' ')[0]} 
                        {discordAccount && (
                            <div className="group/discord relative">
                                <div className="h-2 w-2 rounded-full bg-[#5865F2] shadow-[0_0_8px_#5865F2] cursor-help" />
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-black text-[9px] font-black uppercase tracking-widest text-white rounded opacity-0 group-hover/discord:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">Verified Discord</div>
                            </div>
                        )}
                      </p>
                      <p className="mds-uppercase-label text-[9px] opacity-40 mt-1 truncate uppercase tracking-widest font-black leading-none">{p.name || 'Anonymous'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-all">
                    {p.steamId && (
                      <a href={`https://steamcommunity.com/profiles/${p.steamId}`} target="_blank" rel="noopener noreferrer" className="h-9 px-5 flex items-center justify-center bg-[var(--mds-input)] border border-[var(--mds-border)] rounded-lg text-[10px] font-black uppercase tracking-widest hover:border-[var(--mds-action)]/40 transition-all shadow-sm">
                        Steam
                      </a>
                    )}
                    <button 
                        onClick={() => { if (confirm(`Remove player ${p.name}?`)) onDeletePlayer(p.id); }}
                        className="h-9 w-9 flex items-center justify-center bg-[var(--mds-input)] border border-[var(--mds-border)] rounded-lg hover:text-[var(--mds-red)] hover:border-[var(--mds-red)]/40 transition-all shadow-sm"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )
            })}
            {(!team.players || team.players.length === 0) && (
              <div className="md:col-span-2 py-32 text-center border-2 border-dashed border-[var(--mds-border)] rounded-xl bg-[var(--mds-input)]/10 opacity-30">
                <Users size={32} className="mx-auto mb-4 opacity-40" />
                <div>
                    <p className="mds-uppercase-label text-[11px] font-black uppercase tracking-widest">No Active Personnel</p>
                    <p className="text-[10px] font-bold mt-1 text-[var(--mds-text-subtle)] uppercase">Waiting for roster synchronization</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <footer className="p-10 border-t border-[var(--mds-border)] bg-[var(--mds-input)]/20 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-8 opacity-40 mds-uppercase-label text-[9px] font-black uppercase tracking-widest">
                <div className="flex items-center gap-2"><Mail size={12} /> Team details ready</div>
                <div className="flex items-center gap-2"><Hash size={12} /> Player list synced</div>
            </div>
            <button onClick={onClose} className="mds-btn-primary h-12 px-12 text-[11px] font-black uppercase tracking-widest shadow-lg shadow-[var(--mds-action)]/20 active:scale-95 transition-all">Close Team</button>
        </footer>
      </div>
    </div>
  );
};
