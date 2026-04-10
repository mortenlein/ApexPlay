'use client';

import React from 'react';
import { Settings2, ShieldAlert, Globe, Database, Layout } from 'lucide-react';

interface ManageSettingsProps {
  tournament: any;
  onUpdateTournament: (payload: any) => void;
  onDeleteTournament: () => void;
  updating: boolean;
}

export const ManageSettings: React.FC<ManageSettingsProps> = ({
  tournament,
  onUpdateTournament,
  onDeleteTournament,
  updating,
}) => {
  return (
    <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in duration-500">
      <div className="mds-card p-10 shadow-2xl">
        <div className="flex items-center gap-6 mb-12">
          <div className="h-14 w-14 rounded-xl bg-[var(--mds-action-soft)] text-[var(--mds-action)] border border-[var(--mds-action)]/20 flex items-center justify-center shadow-lg">
            <Settings2 size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight">Tournament Settings</h2>
            <p className="mds-uppercase-label text-[10px] opacity-40 mt-1">Update tournament details, signup rules, and operation locks</p>
          </div>
        </div>

        <form className="space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-4">
              <label className="mds-uppercase-label text-[10px] opacity-60">Tournament Name</label>
              <input
                type="text"
                value={tournament.name}
                onChange={(e) => onUpdateTournament({ name: e.target.value })}
                className="mds-input h-14 px-6 font-black uppercase tracking-tight text-sm"
                placeholder="e.g. invitational finals"
              />
            </div>
            <div className="space-y-4">
              <label className="mds-uppercase-label text-[10px] opacity-60">Game</label>
              <div className="mds-input h-14 flex items-center px-6 opacity-40 bg-[var(--mds-input)] font-bold text-sm tracking-widest cursor-not-allowed">
                {`${tournament.game} | Locked`}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-4">
              <label className="mds-uppercase-label text-[10px] opacity-60">Signup Rules</label>
              <div className="p-6 rounded-xl border border-[var(--mds-border)] bg-[var(--mds-input)]/20 flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-widest text-[var(--mds-text-muted)]">Require Steam Sign-in</span>
                <button
                  type="button"
                  aria-label="Toggle Steam sign-in requirement"
                  onClick={() => onUpdateTournament({ steamSignupEnabled: !tournament.steamSignupEnabled })}
                  className={`h-6 w-11 rounded-full relative transition-all duration-300 ${tournament.steamSignupEnabled ? 'bg-[var(--mds-action)] shadow-[0_0_12px_var(--mds-action)]' : 'bg-gray-700'}`}
                >
                  <div className={`absolute top-1 h-4 w-4 bg-white rounded-full transition-all duration-300 ${tournament.steamSignupEnabled ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
            </div>
            <div className="space-y-4">
              <label className="mds-uppercase-label text-[10px] opacity-60">Visibility</label>
              <div className="p-6 rounded-xl border border-[var(--mds-border)] bg-[var(--mds-input)]/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Globe size={14} className="text-[var(--mds-green)]" />
                  <span className="text-[11px] font-black uppercase tracking-widest">Public page</span>
                </div>
                <span className="mds-badge bg-[var(--mds-green)]/10 text-[var(--mds-green)] border border-[var(--mds-green)]/20 text-[9px] font-black tracking-widest uppercase">Visible</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-4">
              <label className="mds-uppercase-label text-[10px] opacity-60">Operations Safety</label>
              <div className="p-6 rounded-xl border border-[var(--mds-border)] bg-[var(--mds-input)]/20 space-y-4">
                <div className="flex items-center justify-between gap-6">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-widest">Lock roster and seeding</p>
                    <p className="mt-2 text-xs text-[var(--mds-text-muted)]">Stops team edits and bracket regeneration until an admin unlocks it.</p>
                  </div>
                  <button
                    type="button"
                    aria-label="Toggle roster lock"
                    onClick={() => onUpdateTournament({ rosterLocked: !tournament.rosterLocked })}
                    className={`h-6 w-11 rounded-full relative transition-all duration-300 ${tournament.rosterLocked ? 'bg-[var(--mds-amber)] shadow-[0_0_12px_var(--mds-amber)]' : 'bg-gray-700'}`}
                  >
                    <div className={`absolute top-1 h-4 w-4 bg-white rounded-full transition-all duration-300 ${tournament.rosterLocked ? 'left-6' : 'left-1'}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-[var(--mds-border)] bg-[var(--mds-page)] px-4 py-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[var(--mds-text-muted)]">Current state</span>
                  <span className={`mds-badge text-[9px] font-black tracking-widest uppercase ${tournament.rosterLocked ? 'bg-[var(--mds-amber)]/10 text-[var(--mds-amber)] border border-[var(--mds-amber)]/20' : 'bg-[var(--mds-green)]/10 text-[var(--mds-green)] border border-[var(--mds-green)]/20'}`}>
                    {tournament.rosterLocked ? 'Locked' : 'Editable'}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <label className="mds-uppercase-label text-[10px] opacity-60">Data Freshness</label>
              <div className="p-6 rounded-xl border border-[var(--mds-border)] bg-[var(--mds-input)]/20">
                <span className="text-[11px] font-black uppercase tracking-widest text-[var(--mds-text-muted)]">Last updated</span>
                <p className="mt-3 text-sm font-bold text-[var(--mds-text-primary)]">
                  {new Date(tournament.updatedAt).toLocaleString()}
                </p>
                <p className="mt-2 text-xs text-[var(--mds-text-muted)]">
                  Conflict protection uses this timestamp to stop older edits from overwriting newer ones.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-12 border-t border-[var(--mds-border)]">
            <h3 className="mds-uppercase-label text-[var(--mds-red)] mb-8 flex items-center gap-3">
              <ShieldAlert size={16} /> Delete Tournament
            </h3>
            <div className="p-10 mds-card border-[var(--mds-red)]/20 bg-[var(--mds-red)]/5 flex flex-col md:flex-row items-center justify-between gap-10 group hover:border-[var(--mds-red)]/40 transition-all duration-500 hover:shadow-xl hover:shadow-[var(--mds-red)]/5">
              <div className="flex-1 text-center md:text-left">
                <h4 className="text-lg font-black uppercase tracking-tight text-[var(--mds-red)] mb-2">Delete Tournament</h4>
                <p className="text-xs font-bold text-[var(--mds-red)]/60 uppercase tracking-widest leading-relaxed">This permanently removes the tournament, teams, matches, and standings.</p>
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  onDeleteTournament();
                }}
                className="mds-btn-primary bg-[var(--mds-red)] hover:bg-[var(--mds-red)]/80 text-white h-14 px-10 text-xs font-black uppercase tracking-[0.2em] shrink-0 shadow-lg shadow-[var(--mds-red)]/20 active:scale-95 transition-all"
              >
                {updating ? 'Working...' : 'Delete Tournament'}
              </button>
            </div>
          </div>
        </form>
      </div>

      <div className="mds-card p-8 bg-[var(--mds-input)]/40 border border-[var(--mds-border)] flex items-center justify-center gap-10 opacity-50">
        <div className="flex items-center gap-2 mds-uppercase-label text-[8px] tracking-widest font-black uppercase"><Database size={12} /> Saved in the local database</div>
        <div className="flex items-center gap-2 mds-uppercase-label text-[8px] tracking-widest font-black uppercase"><Layout size={12} /> Safe ops controls enabled</div>
      </div>
    </div>
  );
};
