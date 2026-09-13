'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ShieldAlert, Globe, ChevronRight, AlertTriangle } from 'lucide-react';
import {
  BO3_STAGES,
  BO5_STAGES,
  FORMAT_OPTIONS,
  STAGE_LABEL_KEYS,
  getGameMetadata,
  teamSizeLabel,
} from '@/lib/games';

/** Format names are one set for the whole organizer surface; they live with the wizard keys. */
const FORMAT_KEYS: Record<string, { name: string; desc: string }> = {
  SINGLE_ELIMINATION: { name: 'formatSingleName', desc: 'formatSingleDesc' },
  DOUBLE_ELIMINATION: { name: 'formatDoubleName', desc: 'formatDoubleDesc' },
};

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
  const t = useTranslations('organizer.settings');
  const tStage = useTranslations('stage');
  const tWizard = useTranslations('organizer.wizard');
  const tConfirm = useTranslations('organizer.confirm');
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
    if (window.confirm(tConfirm('deleteTournament', { name: tournament.name }))) {
      onDeleteTournament();
    }
  };

  const selectClass = 'mds-input h-11 cursor-pointer appearance-none px-4 pr-10 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <SettingsCard title={t('title')} hint={t('hint')}>
        <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="mds-uppercase-label" htmlFor="tournament-name">{t('name')}</label>
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
                placeholder={t('namePlaceholder')}
              />
              <div className="flex min-h-[2.25rem] items-center justify-between gap-3">
                <p className="text-xs text-[var(--mds-text-subtle)]">
                  {t(nameDirty ? 'unsaved' : 'saved')}
                </p>
                <button
                  type="button"
                  onClick={commitName}
                  disabled={!nameDirty || updating}
                  className="mds-btn-secondary h-9 px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {t(updating ? 'saving' : 'saveName')}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="mds-uppercase-label">{t('game')}</label>
              <div
                className="mds-input flex h-11 cursor-not-allowed items-center px-4 text-sm text-[var(--mds-text-muted)] opacity-60"
                title={t('gameFixed')}
              >
                {t('gameLocked', { game: gameMeta?.name || tournament.game })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ToggleRow
              label={t('requireSteam')}
              description={t('requireSteamHint')}
              checked={Boolean(tournament.steamSignupEnabled)}
              ariaLabel={t('toggleSteam')}
              onToggle={() => onUpdateTournament({ steamSignupEnabled: !tournament.steamSignupEnabled })}
            />
            <div className="flex items-center justify-between gap-4 rounded-lg border border-[var(--mds-border)] bg-[var(--mds-input)]/20 px-4 py-3.5">
              <div className="flex items-center gap-2.5">
                <Globe size={15} className="text-[var(--mds-green)]" />
                <span className="text-sm font-semibold">{t('publicPage')}</span>
              </div>
              <span className="mds-badge border border-[var(--mds-green)]/20 bg-[var(--mds-green)]/10 text-[var(--mds-green)]">
                {t('visible')}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <ToggleRow
                label={t('lockRoster')}
                description={t('lockRosterHint')}
                checked={Boolean(tournament.rosterLocked)}
                ariaLabel={t('toggleLock')}
                tone="warning"
                onToggle={() => onUpdateTournament({ rosterLocked: !tournament.rosterLocked })}
              />
              <div className="flex items-center justify-between rounded-lg border border-[var(--mds-border)] bg-[var(--mds-page)] px-4 py-2.5">
                <span className="mds-uppercase-label">{t('currentState')}</span>
                <span className={`mds-badge ${tournament.rosterLocked ? 'border border-[var(--mds-amber)]/20 bg-[var(--mds-amber)]/10 text-[var(--mds-amber)]' : 'border border-[var(--mds-green)]/20 bg-[var(--mds-green)]/10 text-[var(--mds-green)]'}`}>
                  {t(tournament.rosterLocked ? 'locked' : 'editable')}
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-[var(--mds-border)] bg-[var(--mds-input)]/20 px-4 py-3.5">
              <p className="mds-uppercase-label">{t('lastUpdated')}</p>
              <p className="mds-numeric mt-1.5 text-sm font-semibold">
                {new Date(tournament.updatedAt).toLocaleString()}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-[var(--mds-text-muted)]">
                {t('conflictHint')}
              </p>
            </div>
          </div>
        </form>
      </SettingsCard>

      {/* BRACKET SETTINGS */}
      <SettingsCard title={t('bracketTitle')} hint={t('bracketHint')}>
        {bracketExists && (
          <div className="mb-5 flex items-center gap-2.5 rounded-lg border border-[var(--mds-amber)]/30 bg-[var(--mds-amber)]/5 px-4 py-3">
            <AlertTriangle size={15} className="shrink-0 text-[var(--mds-amber)]" />
            <p className="text-sm font-semibold text-[var(--mds-amber)]">{t('regenerateWarning')}</p>
          </div>
        )}

        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="mds-uppercase-label">{t('bracketStyle')}</label>
              {FORMAT_OPTIONS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={tournament.format === f.id}
                  disabled={updating}
                  onClick={() => tournament.format !== f.id && saveBracketField({ format: f.id })}
                  className={`w-full rounded-lg border-2 p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50 ${tournament.format === f.id ? 'border-[var(--mds-action)] bg-[var(--mds-action)]/10' : 'border-[var(--mds-border)] bg-[var(--mds-input)]/20 hover:border-[var(--mds-action)]/40'}`}
                >
                  <div className="text-sm font-bold">{tWizard(FORMAT_KEYS[f.id].name)}</div>
                  <div className="mt-0.5 text-xs text-[var(--mds-text-muted)]">{tWizard(FORMAT_KEYS[f.id].desc)}</div>
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <label className="mds-uppercase-label">{t('teamSize')}</label>
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
                  label={t('thirdPlace')}
                  description={t('thirdPlaceHint')}
                  checked={Boolean(tournament.hasThirdPlace)}
                  ariaLabel={t('toggleThirdPlace')}
                  disabled={updating}
                  onToggle={() => saveBracketField({ hasThirdPlace: !tournament.hasThirdPlace })}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="mds-uppercase-label" htmlFor="bo3-stage">{t('bo3From')}</label>
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
                    <option key={v} value={String(v)}>{tStage(STAGE_LABEL_KEYS[v])}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 opacity-40">
                  <ChevronRight size={15} className="rotate-90" />
                </div>
              </div>
              <p className="text-xs leading-relaxed text-[var(--mds-text-subtle)]">{t('bo3Help')}</p>
            </div>
            <div className="space-y-1.5">
              <label className="mds-uppercase-label" htmlFor="bo5-stage">{t('bo5From')}</label>
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
                    <option key={v} value={String(v)}>{tStage(STAGE_LABEL_KEYS[v])}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 opacity-40">
                  <ChevronRight size={15} className="rotate-90" />
                </div>
              </div>
              <p className="text-xs leading-relaxed text-[var(--mds-text-subtle)]">{t('bo5Help')}</p>
            </div>
          </div>
        </div>
      </SettingsCard>

      {/* DANGER ZONE */}
      <div className="mds-card border-[var(--mds-red)]/20 bg-[var(--mds-red)]/5 p-6">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-[var(--mds-red)]">
              <ShieldAlert size={16} /> {t('deleteTitle')}
            </h3>
            <p className="mt-1 text-sm text-[var(--mds-text-muted)]">{t('deleteHint')}</p>
          </div>
          <button
            type="button"
            onClick={handleDelete}
            /* Not `.mds-btn-primary`: that class sets `background` in plain CSS and wins over a
               Tailwind bg utility, which rendered the destructive action in brand blue. */
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-sm bg-[var(--mds-red)] px-6 text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            {t('deleteTitle')}
          </button>
        </div>
      </div>
    </div>
  );
};
