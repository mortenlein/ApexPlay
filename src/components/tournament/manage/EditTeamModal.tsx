'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { X, Users, UserPlus, Trash2, Save, Crown, Lock, Loader2 } from 'lucide-react';

export interface PlayerDraft {
  name: string;
  nickname: string;
  seating: string;
  countryCode: string;
  steamId: string;
  isLeader: boolean;
}

interface EditTeamModalProps {
  team: any;
  tournament: any;
  onClose: () => void;
  /** Each handler resolves `true` when the server accepted the write (errors are toasted upstream). */
  onSaveTeam: (payload: { name: string; logoUrl: string; seed: string }) => Promise<boolean>;
  onAddPlayer: (payload: PlayerDraft) => Promise<boolean>;
  onSavePlayer: (playerId: string, payload: PlayerDraft) => Promise<boolean>;
  onDeletePlayer: (playerId: string) => Promise<boolean>;
}

const EMPTY_PLAYER: PlayerDraft = {
  name: '',
  nickname: '',
  seating: '',
  countryCode: '',
  steamId: '',
  isLeader: false,
};

const toDraft = (player: any): PlayerDraft => ({
  name: player.name || '',
  nickname: player.nickname || '',
  seating: player.seating || '',
  countryCode: player.countryCode || '',
  steamId: player.steamId || '',
  isLeader: Boolean(player.isLeader),
});

const sameDraft = (a: PlayerDraft, b: PlayerDraft) =>
  a.name === b.name &&
  a.nickname === b.nickname &&
  a.seating === b.seating &&
  a.countryCode === b.countryCode &&
  a.steamId === b.steamId &&
  a.isLeader === b.isLeader;

const fieldLabel = 'mds-uppercase-label';
const fieldInput = 'mds-input h-9 px-2.5 text-sm';
const rowButton = 'h-9 px-3 flex items-center gap-1.5 rounded-lg border border-[var(--mds-border)] bg-[var(--mds-input)] text-xs font-bold transition-all disabled:opacity-30';

/**
 * Staff team editor. Every field is saved explicitly (per-team "Save details", per-player "Save
 * row") so a half-typed seat label is never pushed to the server on blur.
 *
 * Lock awareness mirrors the API: with `rosterLocked` the team name/logo and every player's
 * name/nickname/seat/flag stay editable (LAN-floor corrections), while seeding, Steam IDs, leader
 * flags, adding and removing players are refused — those inputs are disabled here too, and a 423
 * from the server is surfaced as a toast by the parent.
 */
export const EditTeamModal: React.FC<EditTeamModalProps> = ({
  team,
  tournament,
  onClose,
  onSaveTeam,
  onAddPlayer,
  onSavePlayer,
  onDeletePlayer,
}) => {
  const t = useTranslations('organizer.teamModal');
  const tConfirm = useTranslations('organizer.confirm');
  const tCommon = useTranslations('common');
  const isLocked = Boolean(tournament?.rosterLocked);
  const teamSize = Number(tournament?.teamSize) || 5;
  const players: any[] = team.players || [];
  const atCap = players.length >= teamSize;

  const [teamDraft, setTeamDraft] = useState({
    name: team.name || '',
    logoUrl: team.logoUrl || '',
    seed: team.seed === null || team.seed === undefined ? '' : String(team.seed),
  });
  const [playerDrafts, setPlayerDrafts] = useState<Record<string, PlayerDraft>>({});
  const [newPlayer, setNewPlayer] = useState<PlayerDraft | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Switching to a different team resets every local draft.
  useEffect(() => {
    setTeamDraft({
      name: team.name || '',
      logoUrl: team.logoUrl || '',
      seed: team.seed === null || team.seed === undefined ? '' : String(team.seed),
    });
    setPlayerDrafts({});
    setNewPlayer(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team.id]);

  const teamDirty =
    teamDraft.name !== (team.name || '') ||
    teamDraft.logoUrl !== (team.logoUrl || '') ||
    teamDraft.seed !== (team.seed === null || team.seed === undefined ? '' : String(team.seed));

  const rowFor = (player: any) => playerDrafts[player.id] ?? toDraft(player);
  const rowDirty = (player: any) => !sameDraft(rowFor(player), toDraft(player));

  const patchRow = (player: any, patch: Partial<PlayerDraft>) => {
    setPlayerDrafts((current) => ({
      ...current,
      [player.id]: { ...(current[player.id] ?? toDraft(player)), ...patch },
    }));
  };

  const clearRow = (playerId: string) => {
    setPlayerDrafts((current) => {
      const next = { ...current };
      delete next[playerId];
      return next;
    });
  };

  const handleSaveTeam = async () => {
    if (!teamDraft.name.trim()) return;
    setBusy('team');
    try {
      await onSaveTeam({
        name: teamDraft.name.trim(),
        logoUrl: teamDraft.logoUrl.trim(),
        seed: teamDraft.seed,
      });
    } finally {
      setBusy(null);
    }
  };

  const handleSaveRow = async (player: any) => {
    const draft = rowFor(player);
    if (!draft.name.trim()) return;
    setBusy(player.id);
    try {
      const saved = await onSavePlayer(player.id, draft);
      if (saved) clearRow(player.id);
    } finally {
      setBusy(null);
    }
  };

  const handleAddPlayer = async () => {
    if (!newPlayer || !newPlayer.name.trim()) return;
    setBusy('new');
    try {
      const saved = await onAddPlayer(newPlayer);
      if (saved) setNewPlayer(null);
    } finally {
      setBusy(null);
    }
  };

  const handleDeleteRow = async (player: any) => {
    if (!window.confirm(tConfirm('removePlayer', { player: player.name, team: team.name }))) return;
    setBusy(player.id);
    try {
      const removed = await onDeletePlayer(player.id);
      if (removed) clearRow(player.id);
    } finally {
      setBusy(null);
    }
  };

  /** The five editable fields of a roster row, shared by saved rows and the draft row. */
  const rosterFields = (draft: PlayerDraft, patch: (p: Partial<PlayerDraft>) => void, isDraftRow: boolean) => (
    <div className="grid flex-1 grid-cols-2 gap-3 md:grid-cols-12">
      <div className="col-span-2 space-y-1 md:col-span-3">
        <label className={fieldLabel}>{t('name')}</label>
        <input
          autoFocus={isDraftRow}
          type="text"
          maxLength={64}
          value={draft.name}
          onChange={(e) => patch({ name: e.target.value })}
          className={fieldInput}
          placeholder={t('namePlaceholder')}
        />
      </div>
      <div className="space-y-1 md:col-span-3">
        <label className={fieldLabel}>{t('nickname')}</label>
        <input
          type="text"
          maxLength={64}
          value={draft.nickname}
          onChange={(e) => patch({ nickname: e.target.value })}
          className={fieldInput}
          placeholder={t('nicknamePlaceholder')}
        />
      </div>
      <div className="space-y-1 md:col-span-2">
        <label className={fieldLabel}>{tCommon('seat')}</label>
        <input
          type="text"
          maxLength={16}
          value={draft.seating}
          onChange={(e) => patch({ seating: e.target.value })}
          className={`${fieldInput} mds-numeric uppercase`}
          placeholder={t('seatPlaceholder')}
        />
      </div>
      <div className="space-y-1 md:col-span-1">
        <label className={fieldLabel}>{t('flag')}</label>
        <input
          type="text"
          maxLength={8}
          value={draft.countryCode}
          onChange={(e) => patch({ countryCode: e.target.value.toUpperCase() })}
          className={`${fieldInput} text-center uppercase`}
          placeholder={t('flagPlaceholder')}
        />
      </div>
      <div className="col-span-2 space-y-1 md:col-span-3">
        <label className={fieldLabel}>{t(!isDraftRow && isLocked ? 'steamIdLocked' : 'steamId')}</label>
        <input
          type="text"
          maxLength={64}
          disabled={!isDraftRow && isLocked}
          value={draft.steamId}
          onChange={(e) => patch({ steamId: e.target.value })}
          className={`${fieldInput} font-mono disabled:opacity-30`}
          placeholder={t(isDraftRow ? 'steamIdOptional' : 'steamIdPlaceholder')}
          title={!isDraftRow && isLocked ? t('steamIdLockedTitle') : undefined}
        />
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-[var(--mds-overlay)] backdrop-blur-md" onClick={onClose}></div>
      {/* 92vh with a pinned footer: at 1280x720 the roster scrolls, the window never does. */}
      <div className="mds-card relative z-10 flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden p-0 shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-[var(--mds-border)] bg-[var(--mds-input)]/20 px-6 py-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--mds-border)] bg-[var(--mds-page)]">
              {team.logoUrl ? (
                <Image src={team.logoUrl} fill sizes="48px" alt="" className="object-contain p-1.5" />
              ) : (
                <Users size={20} className="text-[var(--mds-action)]" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="mds-name-lg text-xl">{team.name}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="mds-badge border-[var(--mds-action)]/20 bg-[var(--mds-action-soft)] text-[var(--mds-action)]">
                  {t('seed', { seed: team.seed || '—' })}
                </span>
                <span className="mds-badge border border-[var(--mds-border)] bg-[var(--mds-input)] text-[var(--mds-text-subtle)]">
                  {t('playerCount', { count: players.length, size: teamSize })}
                </span>
                {isLocked ? (
                  <span className="mds-badge flex items-center gap-1.5 border-[var(--mds-amber)]/30 bg-[var(--mds-amber)]/10 text-[var(--mds-amber)]">
                    <Lock size={10} /> {t('rosterLocked')}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={tCommon('close')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-[var(--mds-border)] bg-white/5 text-[var(--mds-text-primary)] transition-colors hover:bg-white/10"
          >
            <X size={18} />
          </button>
        </header>

        <div className="custom-scrollbar min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
          {isLocked ? (
            <div className="rounded-lg border border-[var(--mds-amber)]/30 bg-[var(--mds-amber)]/10 px-4 py-3 text-sm leading-relaxed text-[var(--mds-text-muted)]">
              {t('lockedNotice')}
            </div>
          ) : null}

          {/* TEAM DETAILS */}
          <section>
            <h3 className="text-base font-bold tracking-tight">{t('teamDetails')}</h3>
            <div className="mt-3 grid grid-cols-1 items-end gap-3 md:grid-cols-12">
              <div className="space-y-1 md:col-span-5">
                <label className={fieldLabel}>{t('teamName')}</label>
                <input
                  type="text"
                  maxLength={64}
                  value={teamDraft.name}
                  onChange={(e) => setTeamDraft({ ...teamDraft, name: e.target.value })}
                  className={fieldInput}
                  placeholder={t('teamNamePlaceholder')}
                />
              </div>
              <div className="space-y-1 md:col-span-5">
                <label className={fieldLabel}>{t('logoUrl')}</label>
                <input
                  type="text"
                  value={teamDraft.logoUrl}
                  onChange={(e) => setTeamDraft({ ...teamDraft, logoUrl: e.target.value })}
                  className={fieldInput}
                  placeholder={t('logoUrlPlaceholder')}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className={fieldLabel}>{t('seedLabel')}</label>
                <input
                  type="number"
                  min={1}
                  disabled={isLocked}
                  value={teamDraft.seed}
                  onChange={(e) => setTeamDraft({ ...teamDraft, seed: e.target.value })}
                  className={`${fieldInput} mds-numeric text-center disabled:opacity-30`}
                  placeholder={t('seedPlaceholder')}
                  title={isLocked ? t('seedLockedTitle') : undefined}
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={handleSaveTeam}
                disabled={!teamDirty || !teamDraft.name.trim() || busy === 'team'}
                className="mds-btn-primary h-9 gap-2 px-4 text-sm font-bold disabled:opacity-30"
              >
                {busy === 'team' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {t('saveDetails')}
              </button>
            </div>
          </section>

          {/* ROSTER */}
          <section className="border-t border-[var(--mds-border)] pt-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-bold tracking-tight">
                {t('activeRoster', { count: players.length, size: teamSize })}
              </h3>
              <button
                type="button"
                onClick={() => setNewPlayer(EMPTY_PLAYER)}
                disabled={isLocked || atCap || Boolean(newPlayer)}
                title={isLocked ? t('addPlayerLocked') : atCap ? t('rosterFull', { size: teamSize }) : undefined}
                className="mds-btn-primary h-9 gap-2 px-4 text-sm font-bold disabled:opacity-30"
              >
                <UserPlus size={14} /> {t('addPlayer')}
              </button>
            </div>

            <div className="space-y-3">
              {players.map((player: any, idx: number) => {
                const draft = rowFor(player);
                const dirty = rowDirty(player);
                const rowBusy = busy === player.id;
                return (
                  <div key={player.id} className="mds-card bg-[var(--mds-input)]/20 p-4">
                    <div className="flex items-start gap-3">
                      <div className="mds-numeric mt-6 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--mds-border)] bg-[var(--mds-page)] text-xs font-bold text-[var(--mds-action)]">
                        {(idx + 1).toString().padStart(2, '0')}
                      </div>
                      {rosterFields(draft, (patch) => patchRow(player, patch), false)}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--mds-border)]/60 pt-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => patchRow(player, { isLeader: !draft.isLeader })}
                          title={isLocked ? t('leaderLockedTitle') : undefined}
                          className={`${rowButton} ${draft.isLeader ? 'border-[var(--mds-action)]/40 bg-[var(--mds-action-soft)] text-[var(--mds-action)]' : 'text-[var(--mds-text-muted)]'}`}
                        >
                          <Crown size={13} /> {t(draft.isLeader ? 'teamLeader' : 'notLeader')}
                        </button>
                        {player.steamId ? (
                          <a
                            href={`https://steamcommunity.com/profiles/${player.steamId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${rowButton} text-[var(--mds-text-muted)] hover:border-[var(--mds-action)]/40`}
                          >
                            {t('steam')}
                          </a>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        {dirty ? (
                          <button
                            type="button"
                            onClick={() => clearRow(player.id)}
                            className={`${rowButton} text-[var(--mds-text-muted)] hover:border-[var(--mds-action)]/30`}
                          >
                            {t('revert')}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => handleSaveRow(player)}
                          disabled={!dirty || !draft.name.trim() || rowBusy}
                          className="mds-btn-primary h-9 gap-2 px-4 text-sm font-bold disabled:opacity-30"
                        >
                          {rowBusy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} {tCommon('save')}
                        </button>
                        <button
                          type="button"
                          disabled={isLocked || rowBusy}
                          onClick={() => handleDeleteRow(player)}
                          title={isLocked ? t('removeLockedTitle') : t('removePlayer', { name: player.name })}
                          aria-label={t('removePlayer', { name: player.name })}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--mds-border)] bg-[var(--mds-input)] text-[var(--mds-text-muted)] transition-all hover:border-[var(--mds-red)]/40 hover:text-[var(--mds-red)] disabled:opacity-30"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {newPlayer ? (
                <div className="mds-card border-[var(--mds-action)]/30 bg-[var(--mds-action-soft)]/40 p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-6 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--mds-action)]/30 bg-[var(--mds-page)] text-[var(--mds-action)]">
                      <UserPlus size={15} />
                    </div>
                    {rosterFields(newPlayer, (patch) => setNewPlayer({ ...newPlayer, ...patch }), true)}
                  </div>
                  <div className="mt-3 flex items-center justify-end gap-2 border-t border-[var(--mds-border)]/60 pt-3">
                    <button
                      type="button"
                      onClick={() => setNewPlayer(null)}
                      className={`${rowButton} text-[var(--mds-text-muted)] hover:border-[var(--mds-action)]/30`}
                    >
                      {tCommon('cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={handleAddPlayer}
                      disabled={!newPlayer.name.trim() || busy === 'new'}
                      className="mds-btn-primary h-9 gap-2 px-4 text-sm font-bold disabled:opacity-30"
                    >
                      {busy === 'new' ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />} {t('addToRoster')}
                    </button>
                  </div>
                </div>
              ) : null}

              {players.length === 0 && !newPlayer ? (
                <div className="rounded-lg border border-dashed border-[var(--mds-border)] py-14 text-center">
                  <Users size={24} className="mx-auto mb-3 text-[var(--mds-text-subtle)]" />
                  <p className="text-sm font-bold">{t('emptyTitle')}</p>
                  <p className="mt-1 text-sm text-[var(--mds-text-muted)]">
                    {t(isLocked ? 'emptyLocked' : 'emptyHint')}
                  </p>
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <footer className="flex flex-col items-center justify-between gap-3 border-t border-[var(--mds-border)] bg-[var(--mds-input)]/20 px-6 py-4 md:flex-row">
          <p className="text-xs text-[var(--mds-text-subtle)]">
            {t(teamDirty || Object.keys(playerDrafts).length > 0 || newPlayer ? 'unsaved' : 'allSaved')}
          </p>
          <button onClick={onClose} className="mds-btn-secondary h-10 px-8 text-sm font-bold">
            {tCommon('close')}
          </button>
        </footer>
      </div>
    </div>
  );
};
