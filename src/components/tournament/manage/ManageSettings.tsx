'use client';

import React, { useEffect, useState } from 'react';
import { Settings2, ShieldAlert, Globe, Database, Layout, Layers, ChevronRight, AlertTriangle } from 'lucide-react';
import {
  BO3_STAGES,
  BO5_STAGES,
  FORMAT_OPTIONS,
  STAGE_LABELS,
  getGameMetadata,
  teamSizeLabel,
} from '@/lib/games';

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
  // Renaming is a local edit until the organizer commits it. Every PATCH carries the
  // tournament's `updatedAt` as a concurrency token, so a request per keystroke would
  // make each keystroke after the first conflict.
  const [name, setName] = useState<string>(tournament.name ?? '');

  useEffect(() => {
    setName(tournament.name ?? '');
  }, [tournament.name]);

  const trimmedName = name.trim();
  const nameDirty = trimmedName.length > 0 && trimmedName !== tournament.name;

  const commitName = () => {
    if (!nameDirty) {
      // Nothing to save: snap the field back to the stored value.
      setName(tournament.name ?? '');
      return;
    }
    onUpdateTournament({ name: trimmedName });
  };

  const gameMeta = getGameMetadata(tournament.game);
  const teamSizeOptions = gameMeta?.teamSize ?? [tournament.teamSize].filter(Boolean);

  // GET /api/tournaments/[id] includes `_count`; fall back to an embedded list, then to the
  // roster lock as a proxy for "the bracket is already in play".
  const matchCount: number =
    tournament._count?.matches ??
    tournament.matches?.length ??
    (tournament.rosterLocked ? 1 : 0);
  const bracketExists = matchCount > 0;

  const bo3 = tournament.bo3LastRounds ?? 0;
  const bo5 = tournament.bo5LastRounds ?? 0;

  const saveBracketField = (payload: Record<string, unknown>) => {
    if (updating) return;
    onUpdateTournament(payload);
  };

  const handleDelete = () => {
    if (window.confirm(`Delete "${tournament.name}" permanently?\n\nThis removes the tournament, its teams, matches, and standings. This cannot be undone.`)) {
      onDeleteTournament();
    }
  };

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

        <form className="space-y-12" onSubmit={(e) => e.preventDefault()}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-4">
              <label className="mds-uppercase-label text-[10px] opacity-60" htmlFor="tournament-name">Tournament Name</label>
              <input
                id="tournament-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitName();
                  }
                  if (e.key === 'Escape') {
                    setName(tournament.name ?? '');
                  }
                }}
                className="mds-input h-14 px-6 font-black uppercase tracking-tight text-sm"
                placeholder="e.g. invitational finals"
              />
              <div className="flex items-center justify-between gap-4 min-h-[2rem]">
                <p className="text-[10px] text-[var(--mds-text-subtle)] font-medium">
                  {nameDirty ? 'Unsaved change - press Enter or save.' : 'Saved.'}
                </p>
                <button
                  type="button"
                  onClick={commitName}
                  disabled={!nameDirty || updating}
                  className="mds-btn-secondary h-9 px-5 text-[10px] font-black uppercase tracking-widest disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {updating ? 'Saving...' : 'Save Name'}
                </button>
              </div>
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
        </form>
      </div>

      {/* BRACKET SETTINGS */}
      <div className="mds-card p-10 shadow-2xl">
        <div className="flex items-center gap-6 mb-10">
          <div className="h-14 w-14 rounded-xl bg-[var(--mds-action-soft)] text-[var(--mds-action)] border border-[var(--mds-action)]/20 flex items-center justify-center shadow-lg">
            <Layers size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight">Bracket Settings</h2>
            <p className="mds-uppercase-label text-[10px] opacity-40 mt-1">Format, team size, and series rules - each change saves immediately</p>
          </div>
        </div>

        {bracketExists && (
          <div className="mb-10 flex items-center gap-3 p-4 rounded-xl border border-[var(--mds-amber)]/30 bg-[var(--mds-amber)]/5">
            <AlertTriangle size={16} className="text-[var(--mds-amber)] shrink-0" />
            <p className="text-[11px] font-black uppercase tracking-widest text-[var(--mds-amber)]">
              Regenerate the bracket after changing these
            </p>
          </div>
        )}

        <div className="space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-4">
              <label className="mds-uppercase-label text-[10px] opacity-60">Bracket Style</label>
              <div className="space-y-3">
                {FORMAT_OPTIONS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={tournament.format === f.id}
                    disabled={updating}
                    onClick={() => tournament.format !== f.id && saveBracketField({ format: f.id })}
                    className={`w-full rounded-lg border-2 p-6 text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed ${tournament.format === f.id ? 'border-[var(--mds-action)] bg-[var(--mds-action)]/10 shadow-[0_0_0_1px_var(--mds-action)]' : 'border-[var(--mds-border)] bg-[var(--mds-input)]/20 hover:border-[var(--mds-action)]/40'}`}
                  >
                    <div className="font-bold uppercase tracking-tight text-[var(--mds-text-primary)]">{f.name}</div>
                    <div className="text-[10px] mds-uppercase-label opacity-40 mt-1">{f.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="mds-uppercase-label text-[10px] opacity-60">Team Size</label>
              <div className="grid grid-cols-2 gap-3">
                {teamSizeOptions.map((size: number) => (
                  <button
                    key={size}
                    type="button"
                    aria-pressed={tournament.teamSize === size}
                    disabled={updating}
                    onClick={() => tournament.teamSize !== size && saveBracketField({ teamSize: size })}
                    className={`rounded-lg border-2 p-5 text-center transition-all disabled:opacity-50 disabled:cursor-not-allowed ${tournament.teamSize === size ? 'border-[var(--mds-action)] bg-[var(--mds-action)]/10 shadow-[0_0_0_1px_var(--mds-action)]' : 'border-[var(--mds-border)] bg-[var(--mds-input)]/20 hover:border-[var(--mds-action)]/40'}`}
                  >
                    <div className="font-bold text-lg uppercase tracking-tighter">{teamSizeLabel(gameMeta, size)}</div>
                  </button>
                ))}
              </div>

              <div className="mt-8 p-6 rounded-xl border border-[var(--mds-border)] bg-[var(--mds-input)]/20 flex items-center justify-between">
                <div>
                  <div className="font-bold text-[var(--mds-text-primary)] text-sm uppercase tracking-tight">3rd Place Match</div>
                  <div className="mds-uppercase-label text-[9px] opacity-40 mt-0.5">Determines the bronze medalist</div>
                </div>
                <button
                  type="button"
                  aria-label="Toggle third place match"
                  disabled={updating}
                  onClick={() => saveBracketField({ hasThirdPlace: !tournament.hasThirdPlace })}
                  className={`h-6 w-12 rounded-full relative transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${tournament.hasThirdPlace ? 'bg-[var(--mds-action)] shadow-[0_0_8px_var(--mds-action)]' : 'bg-gray-700'}`}
                >
                  <div className={`absolute top-1 h-4 w-4 bg-white rounded-full transition-all duration-300 ${tournament.hasThirdPlace ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-4">
              <label className="mds-uppercase-label text-[10px] opacity-60" htmlFor="bo3-stage">BO3 From Stage</label>
              <div className="relative">
                <select
                  id="bo3-stage"
                  value={String(bo3)}
                  disabled={updating}
                  onChange={(e) => {
                    const next = Number.parseInt(e.target.value, 10);
                    saveBracketField({ bo3LastRounds: next === 0 ? null : next });
                  }}
                  className="mds-input h-14 cursor-pointer appearance-none px-6 pr-10 font-bold uppercase tracking-tight disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {BO3_STAGES.map((v) => (
                    <option key={v} value={String(v)}>{STAGE_LABELS[v]}</option>
                  ))}
                </select>
                <div className="absolute top-1/2 right-4 -translate-y-1/2 pointer-events-none opacity-40">
                  <ChevronRight size={16} className="rotate-90" />
                </div>
              </div>
              <p className="text-[10px] text-[var(--mds-text-subtle)] font-medium leading-relaxed">BO3 applies from this stage through to the final. Earlier rounds stay BO1.</p>
            </div>
            <div className="space-y-4">
              <label className="mds-uppercase-label text-[10px] opacity-60" htmlFor="bo5-stage">BO5 From Stage</label>
              <div className="relative">
                <select
                  id="bo5-stage"
                  value={String(bo5)}
                  disabled={updating}
                  onChange={(e) => {
                    const next = Number.parseInt(e.target.value, 10);
                    saveBracketField({ bo5LastRounds: next === 0 ? null : next });
                  }}
                  className="mds-input h-14 cursor-pointer appearance-none px-6 pr-10 font-bold uppercase tracking-tight disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {BO5_STAGES.map((v) => (
                    <option key={v} value={String(v)}>{STAGE_LABELS[v]}</option>
                  ))}
                </select>
                <div className="absolute top-1/2 right-4 -translate-y-1/2 pointer-events-none opacity-40">
                  <ChevronRight size={16} className="rotate-90" />
                </div>
              </div>
              <p className="text-[10px] text-[var(--mds-text-subtle)] font-medium leading-relaxed">BO5 overrides BO3 for the stages they share.</p>
            </div>
          </div>
        </div>
      </div>

      {/* DANGER ZONE */}
      <div className="mds-card p-10 shadow-2xl">
        <h3 className="mds-uppercase-label text-[var(--mds-red)] mb-8 flex items-center gap-3">
          <ShieldAlert size={16} /> Delete Tournament
        </h3>
        <div className="p-10 mds-card border-[var(--mds-red)]/20 bg-[var(--mds-red)]/5 flex flex-col md:flex-row items-center justify-between gap-10 group hover:border-[var(--mds-red)]/40 transition-all duration-500 hover:shadow-xl hover:shadow-[var(--mds-red)]/5">
          <div className="flex-1 text-center md:text-left">
            <h4 className="text-lg font-black uppercase tracking-tight text-[var(--mds-red)] mb-2">Delete Tournament</h4>
            <p className="text-xs font-bold text-[var(--mds-red)]/60 uppercase tracking-widest leading-relaxed">This permanently removes the tournament, teams, matches, and standings.</p>
          </div>
          <button
            type="button"
            onClick={handleDelete}
            className="mds-btn-primary bg-[var(--mds-red)] hover:bg-[var(--mds-red)]/80 text-white h-14 px-10 text-xs font-black uppercase tracking-[0.2em] shrink-0 shadow-lg shadow-[var(--mds-red)]/20 active:scale-95 transition-all"
          >
            Delete Tournament
          </button>
        </div>
      </div>

      <div className="mds-card p-8 bg-[var(--mds-input)]/40 border border-[var(--mds-border)] flex items-center justify-center gap-10 opacity-50">
        <div className="flex items-center gap-2 mds-uppercase-label text-[8px] tracking-widest font-black uppercase"><Database size={12} /> Saved in the local database</div>
        <div className="flex items-center gap-2 mds-uppercase-label text-[8px] tracking-widest font-black uppercase"><Layout size={12} /> Safe ops controls enabled</div>
      </div>
    </div>
  );
};
