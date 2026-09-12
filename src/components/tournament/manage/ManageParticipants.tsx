'use client';

import React from 'react';
import { Plus, Users, Settings2, Trash2, Save, Info, GripVertical } from 'lucide-react';
import Image from 'next/image';
import { Badge } from '@/components/ui';

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
  const teamSize = Number(tournament.teamSize) || 5;

  // The registration form always shows `teamSize` roster rows so an admin-created team gets a real
  // roster (blank rows are dropped before the POST — admins may register a partial team).
  const rosterRows: any[] = Array.from({ length: teamSize }, (_, index) =>
    newTeam.players?.[index] ?? { name: '', nickname: '', seating: '', steamId: '' }
  );

  const setRosterRow = (index: number, patch: Record<string, string>) => {
    const next = rosterRows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row));
    setNewTeam({ ...newTeam, players: next });
  };

  const filledRosterCount = rosterRows.filter((row) => (row.name || '').trim() || (row.nickname || '').trim()).length;
  const fieldInput = 'mds-input h-10 px-3 text-sm';

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* THE LIST FIRST: on a laptop the roster is what the organizer came for. */}
      <div className="lg:col-span-8 lg:order-2">
        <div className="mds-card overflow-hidden p-0">
          <header className="flex flex-col gap-3 border-b border-[var(--mds-border)] bg-[var(--mds-input)]/20 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold tracking-tight">Teams</h2>
              <Badge tone="neutral">{teams.length} registered</Badge>
            </div>
            {Object.keys(draftSeeds).length > 0 ? (
              <button
                onClick={onSaveSeeds}
                disabled={isLocked}
                className="mds-btn-primary h-9 gap-2 px-4 text-sm font-bold disabled:opacity-40"
              >
                <Save size={14} /> Save seeding
              </button>
            ) : null}
          </header>

          <div className="custom-scrollbar max-h-[640px] divide-y divide-[var(--mds-border)]/60 overflow-y-auto">
            {sortedTeams.map((team: any, index: number) => (
              <div
                key={team.id}
                draggable={!isLocked}
                onDragStart={(e) => onDragStart(e, index)}
                onDragOver={(e) => onDragOver(e, index)}
                onDragEnd={onDragEnd}
                className={`group flex items-center justify-between gap-4 px-6 py-3 transition-colors ${isLocked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'} hover:bg-[var(--mds-input)]/40 ${draggedItemIndex === index ? 'opacity-20' : ''}`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <GripVertical size={15} className="shrink-0 text-[var(--mds-text-subtle)] opacity-40 group-hover:opacity-100" />
                  {/* `.mds-input` is width:100%, so the seed box needs a sized wrapper or it eats
                      the row and squeezes the team name into a one-character column. */}
                  <div className="w-14 shrink-0">
                    <input
                      type="number"
                      aria-label={`Seed for ${team.name}`}
                      disabled={isLocked}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const val = e.target.value === '' ? '' : Number(e.target.value);
                        setDraftSeeds({ ...draftSeeds, [team.id]: val });
                      }}
                      value={draftSeeds[team.id] !== undefined ? draftSeeds[team.id] : (team.seed || index + 1)}
                      className="mds-input mds-numeric h-9 border-[var(--mds-border)] bg-transparent px-0 text-center font-bold text-[var(--mds-action)]"
                    />
                  </div>
                  <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--mds-border)] bg-[var(--mds-page)]">
                    {team.logoUrl ? (
                      <Image src={team.logoUrl} fill alt="" className="object-contain p-1.5" />
                    ) : (
                      <Users size={16} className="text-[var(--mds-text-muted)]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="mds-name text-sm">{team.name}</p>
                    <p className="mt-0.5 text-xs text-[var(--mds-text-subtle)]">
                      {team.players?.length || 0} of {teamSize} players
                    </p>
                  </div>
                </div>

                {/* Both stay live while the roster is locked: the modal still allows name/seat
                    corrections, and removal falls back to a forced pull-out (confirmed upstream). */}
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => onEditTeam(team)}
                    title={`Edit ${team.name}`}
                    aria-label={`Edit ${team.name}`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--mds-border)] bg-[var(--mds-input)] text-[var(--mds-text-muted)] transition-all hover:border-[var(--mds-action)]/40 hover:text-[var(--mds-action)]"
                  >
                    <Settings2 size={15} />
                  </button>
                  <button
                    onClick={() => onDeleteTeam(team.id)}
                    title={`Remove ${team.name}`}
                    aria-label={`Remove ${team.name}`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--mds-border)] bg-[var(--mds-input)] text-[var(--mds-text-muted)] transition-all hover:border-[var(--mds-red)]/40 hover:text-[var(--mds-red)]"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}

            {teams.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-20 text-center">
                <Users size={28} className="text-[var(--mds-text-subtle)]" />
                <div>
                  <p className="text-sm font-bold">No teams yet</p>
                  <p className="mt-1 text-sm text-[var(--mds-text-muted)]">
                    {isLocked ? 'Unlock roster edits to add teams' : 'Register a team with the form, or paste a CSV.'}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-6 lg:col-span-4 lg:order-1">
        <div className="mds-card p-5">
          <h2 className="text-lg font-bold tracking-tight">Register Team</h2>
          <form onSubmit={onAddTeam} className="mt-4 space-y-4">
            {isLocked ? (
              <div className="rounded-lg border border-[var(--mds-amber)]/30 bg-[var(--mds-amber)]/10 px-3 py-3 text-sm leading-relaxed text-[var(--mds-text-muted)]">
                Roster edits are locked because the bracket is already in play. Unlock roster edits in settings before adding or removing teams.
              </div>
            ) : null}
            <div className="space-y-1.5">
              <label className="mds-uppercase-label" htmlFor="new-team-name">Team name</label>
              <input
                id="new-team-name"
                type="text"
                required
                disabled={isLocked}
                value={newTeam.name}
                onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                className={fieldInput}
                placeholder="Enter team name"
              />
            </div>
            <div className="space-y-1.5">
              <label className="mds-uppercase-label" htmlFor="new-team-seed">Initial seed (1-99)</label>
              <input
                id="new-team-seed"
                type="number"
                disabled={isLocked}
                value={newTeam.seed}
                onChange={(e) => setNewTeam({ ...newTeam, seed: e.target.value })}
                className={`${fieldInput} mds-numeric`}
                placeholder="Seed position"
              />
            </div>

            <div className="space-y-2 border-t border-[var(--mds-border)] pt-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="mds-uppercase-label">Roster ({filledRosterCount}/{teamSize})</span>
                <span className="text-xs text-[var(--mds-text-subtle)]">Blank rows are skipped</span>
              </div>
              {rosterRows.map((row, index) => (
                <div key={index} className="space-y-2 rounded-lg border border-[var(--mds-border)] bg-[var(--mds-input)]/20 p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="mds-numeric w-5 shrink-0 text-xs text-[var(--mds-action)]">
                      {(index + 1).toString().padStart(2, '0')}
                    </span>
                    <input
                      type="text"
                      maxLength={64}
                      disabled={isLocked}
                      value={row.name || ''}
                      onChange={(e) => setRosterRow(index, { name: e.target.value })}
                      className="mds-input h-9 px-2.5 text-sm"
                      placeholder={index === 0 ? 'Player name (captain)' : 'Player name'}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 pl-7">
                    <input
                      type="text"
                      maxLength={64}
                      disabled={isLocked}
                      value={row.nickname || ''}
                      onChange={(e) => setRosterRow(index, { nickname: e.target.value })}
                      className="mds-input h-9 px-2 text-xs"
                      placeholder="Nick"
                    />
                    <input
                      type="text"
                      maxLength={16}
                      disabled={isLocked}
                      value={row.seating || ''}
                      onChange={(e) => setRosterRow(index, { seating: e.target.value })}
                      className="mds-input mds-numeric h-9 px-2 text-xs uppercase"
                      placeholder="Seat"
                    />
                    <input
                      type="text"
                      maxLength={64}
                      disabled={isLocked}
                      value={row.steamId || ''}
                      onChange={(e) => setRosterRow(index, { steamId: e.target.value })}
                      className="mds-input mds-numeric h-9 px-2 text-xs"
                      placeholder="SteamID"
                    />
                  </div>
                </div>
              ))}
            </div>

            <button type="submit" disabled={isLocked} className="mds-btn-primary h-11 w-full gap-2 text-sm font-bold disabled:opacity-40">
              <Plus size={16} /> Add Team
            </button>
          </form>
        </div>

        <div className="mds-card border-[var(--mds-action)]/20 bg-[var(--mds-action-soft)] p-5">
          <div className="flex items-start gap-3">
            <Info size={16} className="mt-0.5 shrink-0 text-[var(--mds-action)]" />
            <p className="text-sm leading-relaxed text-[var(--mds-text-muted)]">
              Drag teams to reorder the bracket seeds, or type a seed number directly. Once the bracket is live,
              lock roster edits in settings to prevent accidental changes.
            </p>
          </div>
        </div>

        <div className="mds-card p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold tracking-tight">Bulk import</h3>
              <p className="mt-0.5 text-xs text-[var(--mds-text-muted)]">Paste CSV rows to register several teams at once.</p>
            </div>
            <button type="button" onClick={onExportCsv} className="mds-btn-secondary h-9 shrink-0 px-4 text-sm font-bold">
              Export CSV
            </button>
          </div>
          <textarea
            value={importCsv}
            onChange={(event) => setImportCsv(event.target.value)}
            disabled={isLocked}
            className="mds-input min-h-[140px] resize-y font-mono text-xs leading-6"
            placeholder="teamName,seed,playerName,nickname,countryCode,seating,steamId,isLeader"
          />
          <button
            type="button"
            disabled={isLocked || importing || !importCsv.trim()}
            onClick={onImportCsv}
            className="mds-btn-primary mt-3 h-10 w-full text-sm font-bold disabled:opacity-40"
          >
            {importing ? 'Importing teams…' : 'Import teams'}
          </button>
        </div>
      </div>
    </div>
  );
};
