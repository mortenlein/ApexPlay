'use client';

import React, { useEffect, useState } from 'react';
import { ShieldAlert, Globe, ChevronRight, AlertTriangle } from 'lucide-react';
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

/** Section wrapper: one card, one heading, one job. */
function SettingsCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mds-card p-6">
      <div className="mb-5">
        <h2 className="text-lg font-bold tracking-tight">{title}</h2>
        {hint ? <p className="mt-1 text-sm text-[var(--mds-text-muted)]">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

/** A labelled row with a switch on the right — the shape every toggle here uses. */
function ToggleRow({
  label,
  description,
  checked,
  onToggle,
  ariaLabel,
  disabled,
  tone = 'brand',
}: {
  label: string;
  description?: string;
  checked: boolean;
  onToggle: () => void;
  ariaLabel: string;
  disabled?: boolean;
  tone?: 'brand' | 'warning';
}) {
  const onColor = tone === 'warning' ? 'var(--mds-amber)' : 'var(--mds-action)';
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-[var(--mds-border)] bg-[var(--mds-input)]/20 px-4 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        {description ? <p className="mt-1 text-xs leading-relaxed text-[var(--mds-text-muted)]">{description}</p> : null}
      </div>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-pressed={checked}
        disabled={disabled}
        onClick={onToggle}
        style={checked ? { background: onColor } : undefined}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-all disabled:opacity-50 ${checked ? '' : 'bg-gray-700'}`}
      >
        <div className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${checked ? 'left-6' : 'left-1'}`} />
      </button>
    </div>
  );
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

  const selectClass = 'mds-input h-11 cursor-pointer appearance-none px-4 pr-10 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <SettingsCard title="Tournament Settings" hint="Name, signup rules, and the operations lock.">
        <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="mds-uppercase-label" htmlFor="tournament-name">Tournament name</label>
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
                className="mds-input mds-name h-11 px-4 text-sm"
                placeholder="e.g. Invitational Finals"
              />
              <div className="flex min-h-[2.25rem] items-center justify-between gap-3">
                <p className="text-xs text-[var(--mds-text-subtle)]">
                  {nameDirty ? 'Unsaved change - press Enter or save.' : 'Saved.'}
                </p>
                <button
                  type="button"
                  onClick={commitName}
                  disabled={!nameDirty || updating}
                  className="mds-btn-secondary h-9 px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {updating ? 'Saving…' : 'Save Name'}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="mds-uppercase-label">Game</label>
              <div
                className="mds-input flex h-11 cursor-not-allowed items-center px-4 text-sm text-[var(--mds-text-muted)] opacity-60"
                title="The game is fixed when the tournament is created"
              >
                {`${gameMeta?.name || tournament.game} · Locked`}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ToggleRow
              label="Require Steam sign-in"
              description="Players sign in with Steam to register themselves."
              checked={Boolean(tournament.steamSignupEnabled)}
              ariaLabel="Toggle Steam sign-in requirement"
              onToggle={() => onUpdateTournament({ steamSignupEnabled: !tournament.steamSignupEnabled })}
            />
            <div className="flex items-center justify-between gap-4 rounded-lg border border-[var(--mds-border)] bg-[var(--mds-input)]/20 px-4 py-3.5">
              <div className="flex items-center gap-2.5">
                <Globe size={15} className="text-[var(--mds-green)]" />
                <span className="text-sm font-semibold">Public page</span>
              </div>
              <span className="mds-badge border border-[var(--mds-green)]/20 bg-[var(--mds-green)]/10 text-[var(--mds-green)]">
                Visible
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <ToggleRow
                label="Lock roster and seeding"
                description="Stops team edits and bracket regeneration until an admin unlocks it."
                checked={Boolean(tournament.rosterLocked)}
                ariaLabel="Toggle roster lock"
                tone="warning"
                onToggle={() => onUpdateTournament({ rosterLocked: !tournament.rosterLocked })}
              />
              <div className="flex items-center justify-between rounded-lg border border-[var(--mds-border)] bg-[var(--mds-page)] px-4 py-2.5">
                <span className="mds-uppercase-label">Current state</span>
                <span className={`mds-badge ${tournament.rosterLocked ? 'border border-[var(--mds-amber)]/20 bg-[var(--mds-amber)]/10 text-[var(--mds-amber)]' : 'border border-[var(--mds-green)]/20 bg-[var(--mds-green)]/10 text-[var(--mds-green)]'}`}>
                  {tournament.rosterLocked ? 'Locked' : 'Editable'}
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-[var(--mds-border)] bg-[var(--mds-input)]/20 px-4 py-3.5">
              <p className="mds-uppercase-label">Last updated</p>
              <p className="mds-numeric mt-1.5 text-sm font-semibold">
                {new Date(tournament.updatedAt).toLocaleString()}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-[var(--mds-text-muted)]">
                Conflict protection uses this timestamp to stop older edits from overwriting newer ones.
              </p>
            </div>
          </div>
        </form>
      </SettingsCard>

      {/* BRACKET SETTINGS */}
      <SettingsCard title="Bracket Settings" hint="Format, team size, and series rules — each change saves immediately.">
        {bracketExists && (
          <div className="mb-5 flex items-center gap-2.5 rounded-lg border border-[var(--mds-amber)]/30 bg-[var(--mds-amber)]/5 px-4 py-3">
            <AlertTriangle size={15} className="shrink-0 text-[var(--mds-amber)]" />
            <p className="text-sm font-semibold text-[var(--mds-amber)]">
              Regenerate the bracket after changing these
            </p>
          </div>
        )}

        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="mds-uppercase-label">Bracket style</label>
              {FORMAT_OPTIONS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={tournament.format === f.id}
                  disabled={updating}
                  onClick={() => tournament.format !== f.id && saveBracketField({ format: f.id })}
                  className={`w-full rounded-lg border-2 p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50 ${tournament.format === f.id ? 'border-[var(--mds-action)] bg-[var(--mds-action)]/10' : 'border-[var(--mds-border)] bg-[var(--mds-input)]/20 hover:border-[var(--mds-action)]/40'}`}
                >
                  <div className="text-sm font-bold">{f.name}</div>
                  <div className="mt-0.5 text-xs text-[var(--mds-text-muted)]">{f.desc}</div>
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <label className="mds-uppercase-label">Team size</label>
              <div className="grid grid-cols-2 gap-2">
                {teamSizeOptions.map((size: number) => (
                  <button
                    key={size}
                    type="button"
                    aria-pressed={tournament.teamSize === size}
                    disabled={updating}
                    onClick={() => tournament.teamSize !== size && saveBracketField({ teamSize: size })}
                    className={`rounded-lg border-2 p-3.5 text-center text-base font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${tournament.teamSize === size ? 'border-[var(--mds-action)] bg-[var(--mds-action)]/10' : 'border-[var(--mds-border)] bg-[var(--mds-input)]/20 hover:border-[var(--mds-action)]/40'}`}
                  >
                    {teamSizeLabel(gameMeta, size)}
                  </button>
                ))}
              </div>

              <div className="pt-2">
                <ToggleRow
                  label="3rd place match"
                  description="Decides the bronze medal between the two losing semi-finalists."
                  checked={Boolean(tournament.hasThirdPlace)}
                  ariaLabel="Toggle third place match"
                  disabled={updating}
                  onToggle={() => saveBracketField({ hasThirdPlace: !tournament.hasThirdPlace })}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="mds-uppercase-label" htmlFor="bo3-stage">BO3 from stage</label>
              <div className="relative">
                <select
                  id="bo3-stage"
                  value={String(bo3)}
                  disabled={updating}
                  onChange={(e) => {
                    const next = Number.parseInt(e.target.value, 10);
                    saveBracketField({ bo3LastRounds: next === 0 ? null : next });
                  }}
                  className={selectClass}
                >
                  {BO3_STAGES.map((v) => (
                    <option key={v} value={String(v)}>{STAGE_LABELS[v]}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 opacity-40">
                  <ChevronRight size={15} className="rotate-90" />
                </div>
              </div>
              <p className="text-xs leading-relaxed text-[var(--mds-text-subtle)]">BO3 applies from this stage through to the final. Earlier rounds stay BO1.</p>
            </div>
            <div className="space-y-1.5">
              <label className="mds-uppercase-label" htmlFor="bo5-stage">BO5 from stage</label>
              <div className="relative">
                <select
                  id="bo5-stage"
                  value={String(bo5)}
                  disabled={updating}
                  onChange={(e) => {
                    const next = Number.parseInt(e.target.value, 10);
                    saveBracketField({ bo5LastRounds: next === 0 ? null : next });
                  }}
                  className={selectClass}
                >
                  {BO5_STAGES.map((v) => (
                    <option key={v} value={String(v)}>{STAGE_LABELS[v]}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 opacity-40">
                  <ChevronRight size={15} className="rotate-90" />
                </div>
              </div>
              <p className="text-xs leading-relaxed text-[var(--mds-text-subtle)]">BO5 overrides BO3 for the stages they share.</p>
            </div>
          </div>
        </div>
      </SettingsCard>

      {/* DANGER ZONE */}
      <div className="mds-card border-[var(--mds-red)]/20 bg-[var(--mds-red)]/5 p-6">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-[var(--mds-red)]">
              <ShieldAlert size={16} /> Delete Tournament
            </h3>
            <p className="mt-1 text-sm text-[var(--mds-text-muted)]">
              Permanently removes the tournament, its teams, matches, and standings.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDelete}
            className="mds-btn-primary h-11 shrink-0 bg-[var(--mds-red)] px-6 text-sm font-bold text-white hover:bg-[var(--mds-red)]/80"
          >
            Delete Tournament
          </button>
        </div>
      </div>
    </div>
  );
};
