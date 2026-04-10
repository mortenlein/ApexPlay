'use client';

import React from 'react';
import { UserPlus, Plus, Search, Users, Settings2, Trash2, Save, Info, GripVertical } from 'lucide-react';
import Image from 'next/image';

interface ManageParticipantsProps {
  tournament: any;
  teams: any[];
  newTeam: any;
  setNewTeam: (team: any) => void;
  onAddTeam: (e: React.FormEvent) => void;
  onEditTeam: (team: any) => void;
  onDeleteTeam: (id: string) => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  draggedItemIndex: number | null;
  draftSeeds: Record<string, number | string>;
  setDraftSeeds: (seeds: Record<string, number | string>) => void;
  onSaveSeeds: () => void;
  importCsv: string;
  setImportCsv: (value: string) => void;
  onImportCsv: () => void;
  onExportCsv: () => void;
  importing: boolean;
}

export const ManageParticipants: React.FC<ManageParticipantsProps> = ({
  tournament,
  teams,
  newTeam,
  setNewTeam,
  onAddTeam,
  onEditTeam,
  onDeleteTeam,
  onDragStart,
  onDragOver,
  onDragEnd,
  draggedItemIndex,
  draftSeeds,
  setDraftSeeds,
  onSaveSeeds,
  importCsv,
  setImportCsv,
  onImportCsv,
  onExportCsv,
  importing,
}) => {
  const sortedTeams = [...teams].sort((a, b) => (Number(a.seed) || 999) - (Number(b.seed) || 999));
  const isLocked = tournament.rosterLocked;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in fade-in duration-500">
      <div className="lg:col-span-4 space-y-8">
        <div className="mds-card p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-lg bg-[var(--mds-action-soft)] text-[var(--mds-action)] border border-[var(--mds-action)]/20 flex items-center justify-center shadow-sm">
              <UserPlus size={18} />
            </div>
            <h2 className="text-xl font-black uppercase tracking-tight">Register Team</h2>
          </div>
          <form onSubmit={onAddTeam} className="space-y-6">
            {isLocked ? (
              <div className="rounded-xl border border-[var(--mds-amber)]/30 bg-[var(--mds-amber)]/10 px-4 py-4 text-sm text-[var(--mds-text-muted)]">
                Roster edits are locked because the bracket is already in play. Unlock roster edits in settings before adding or removing teams.
              </div>
            ) : null}
            <div className="space-y-2.5">
              <label className="mds-uppercase-label text-[9px] opacity-40">Team Name</label>
              <input
                type="text"
                required
                disabled={isLocked}
                value={newTeam.name}
                onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                className="mds-input h-12 px-4 text-sm font-bold uppercase tracking-tight"
                placeholder="Enter team name"
              />
            </div>
            <div className="space-y-2.5">
              <label className="mds-uppercase-label text-[9px] opacity-40">Initial Seed (1-99)</label>
              <input
                type="number"
                disabled={isLocked}
                value={newTeam.seed}
                onChange={(e) => setNewTeam({ ...newTeam, seed: e.target.value })}
                className="mds-input h-12 px-4 text-sm font-bold uppercase tracking-tight"
                placeholder="Seed position"
              />
            </div>
            <button type="submit" disabled={isLocked} className="mds-btn-primary w-full h-12 text-xs font-black uppercase tracking-widest gap-2 disabled:opacity-40">
              <Plus size={16} /> Add Team
            </button>
          </form>
        </div>

        <div className="mds-card p-8 bg-[var(--mds-action-soft)] border-[var(--mds-action)]/20">
          <div className="flex items-start gap-4">
            <Info size={20} className="text-[var(--mds-action)] shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-black uppercase tracking-tight text-[var(--mds-action)] mb-1">Seeding protocol</h4>
              <p className="text-xs text-[var(--mds-text-subtle)] leading-relaxed font-medium">
                Drag teams to reorder the bracket seeds, or edit the seed numbers directly. Once the bracket is live, lock roster edits to prevent accidental changes.
              </p>
            </div>
          </div>
        </div>

        <div className="mds-card p-8">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight">Bulk import</h3>
              <p className="mt-1 text-xs text-[var(--mds-text-muted)]">Paste CSV rows to register multiple teams at once.</p>
            </div>
            <button type="button" onClick={onExportCsv} className="mds-btn-secondary h-9 px-4 text-[10px] font-black uppercase tracking-widest">
              Export CSV
            </button>
          </div>
          <textarea
            value={importCsv}
            onChange={(event) => setImportCsv(event.target.value)}
            disabled={isLocked}
            className="mds-input min-h-[180px] resize-y font-mono text-xs leading-6"
            placeholder="teamName,seed,playerName,nickname,countryCode,seating,steamId,isLeader"
          />
          <button
            type="button"
            disabled={isLocked || importing || !importCsv.trim()}
            onClick={onImportCsv}
            className="mt-4 w-full mds-btn-primary h-11 text-xs font-black uppercase tracking-widest disabled:opacity-40"
          >
            {importing ? 'Importing teams...' : 'Import teams'}
          </button>
        </div>
      </div>

      <div className="lg:col-span-8">
        <div className="mds-card p-0 overflow-hidden shadow-xl">
          <header className="px-8 py-6 border-b border-[var(--mds-border)] bg-[var(--mds-input)]/20 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <h2 className="text-lg font-black uppercase tracking-tight">Teams</h2>
              <span className="mds-badge bg-[var(--mds-input)] border border-[var(--mds-border)] text-[9px] font-black uppercase tracking-widest">{teams.length} Teams Registered</span>
            </div>
            {Object.keys(draftSeeds).length > 0 ? (
              <button onClick={onSaveSeeds} disabled={isLocked} className="mds-btn-primary h-9 px-4 text-[10px] font-black uppercase tracking-widest gap-2 animate-pulse disabled:opacity-40">
                <Save size={14} /> Commit Seeds
              </button>
            ) : null}
          </header>

          <div className="divide-y divide-[var(--mds-border)]/50 max-h-[700px] overflow-y-auto custom-scrollbar">
            {sortedTeams.map((team: any, index: number) => (
              <div
                key={team.id}
                draggable={!isLocked}
                onDragStart={(e) => onDragStart(e, index)}
                onDragOver={(e) => onDragOver(e, index)}
                onDragEnd={onDragEnd}
                className={`px-8 py-4 flex items-center justify-between group transition-all ${isLocked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'} hover:bg-[var(--mds-input)]/40 ${draggedItemIndex === index ? 'opacity-20 scale-[0.98]' : ''}`}
              >
                <div className="flex items-center gap-6 flex-1 min-w-0">
                  <div className="flex items-center gap-4 shrink-0 pointer-events-auto">
                    <GripVertical size={16} className="text-[var(--mds-text-muted)] opacity-20 group-hover:opacity-100 transition-opacity" />
                    <input
                      type="number"
                      disabled={isLocked}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const val = e.target.value === '' ? '' : Number(e.target.value);
                        setDraftSeeds({ ...draftSeeds, [team.id]: val });
                      }}
                      value={draftSeeds[team.id] !== undefined ? draftSeeds[team.id] : (team.seed || index + 1)}
                      className="w-12 h-10 mds-input text-center font-mono font-bold text-[var(--mds-action)] border-[var(--mds-border)] focus:border-[var(--mds-action)] bg-transparent"
                    />
                  </div>
                  <div className="truncate flex items-center gap-5">
                    <div className="h-12 w-12 shrink-0 bg-[var(--mds-page)] border border-[var(--mds-border)] rounded-lg overflow-hidden relative flex items-center justify-center group-hover:border-[var(--mds-action)]/30 transition-all shadow-inner">
                      {team.logoUrl ? (
                        <Image src={team.logoUrl} fill alt="" className="object-contain p-2 grayscale brightness-125" />
                      ) : (
                        <Users size={18} className="text-[var(--mds-text-muted)]" />
                      )}
                    </div>
                    <div>
                      <p className="text-base font-black uppercase tracking-tight group-hover:text-[var(--mds-action)] transition-colors truncate">{team.name}</p>
                      <p className="mds-uppercase-label text-[8px] opacity-40 mt-1">{team.players?.length || 0} players</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                  <button
                    disabled={isLocked}
                    onClick={() => onEditTeam(team)}
                    className="h-10 w-10 flex items-center justify-center rounded-lg bg-[var(--mds-input)] border border-[var(--mds-border)] hover:border-[var(--mds-action)]/40 hover:text-[var(--mds-action)] transition-all shadow-sm disabled:opacity-30"
                  >
                    <Settings2 size={16} />
                  </button>
                  <button
                    disabled={isLocked}
                    onClick={() => { if (confirm(`Remove team ${team.name}?`)) onDeleteTeam(team.id); }}
                    className="h-10 w-10 flex items-center justify-center rounded-lg bg-[var(--mds-input)] border border-[var(--mds-border)] hover:border-[var(--mds-red)]/40 hover:text-[var(--mds-red)] transition-all shadow-sm disabled:opacity-30"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}

            {teams.length === 0 ? (
              <div className="py-32 text-center opacity-30 flex flex-col items-center gap-4">
                <Search size={40} className="text-[var(--mds-text-muted)]" />
                <div>
                  <p className="mds-uppercase-label text-[10px] tracking-widest">No teams yet</p>
                  <p className="text-[10px] font-bold mt-1 text-[var(--mds-text-subtle)] uppercase">{isLocked ? 'Unlock roster edits to add teams' : 'Add a team to get started'}</p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
