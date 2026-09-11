'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { X, Users, UserPlus, Trash2, ShieldCheck, Save, Crown, Lock, Loader2 } from 'lucide-react';

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

const fieldLabel = 'mds-uppercase-label text-[9px] opacity-40';
const fieldInput = 'mds-input h-10 px-3 text-xs font-bold tracking-tight';

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
    if (!window.confirm(`Remove ${player.name} from ${team.name}?`)) return;
    setBusy(player.id);
    try {
      const removed = await onDeletePlayer(player.id);
      if (removed) clearRow(player.id);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-[var(--mds-overlay)] backdrop-blur-md" onClick={onClose}></div>
      <div className="mds-card w-full max-w-5xl max-h-[92vh] p-0 relative z-10 flex flex-col overflow-hidden shadow-2xl scale-in-center duration-300 border-[var(--mds-action)]/20">
        <header className="px-8 py-8 border-b border-[var(--mds-border)] flex items-start justify-between gap-6 bg-[var(--mds-input)]/20">
          <div className="flex items-center gap-6 min-w-0">
            <div className="relative h-20 w-20 bg-[var(--mds-page)] rounded-xl border border-[var(--mds-border)] flex items-center justify-center overflow-hidden shadow-lg shrink-0 transition-all hover:border-[var(--mds-action)]/30">
              {team.logoUrl ? (
                <Image src={team.logoUrl} fill sizes="80px" alt="" className="object-contain p-2 grayscale brightness-125" />
              ) : (
                <Users size={32} className="text-[var(--mds-action)]" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-3xl font-black uppercase tracking-tight text-[var(--mds-text-primary)] leading-[0.95] mb-3 truncate">{team.name}</h2>
              <div className="flex flex-wrap items-center gap-3">
                <span className="mds-badge bg-[var(--mds-action-soft)] text-[var(--mds-action)] font-black uppercase text-[10px] tracking-widest border-[var(--mds-action)]/20 px-3 py-1.5 shadow-sm">
                  Seed: {team.seed || 'Unranked'}
                </span>
                <span className="mds-uppercase-label text-[9px] opacity-40 uppercase tracking-[0.2em] font-black">Team ID: {String(team.id).split('-')[0].toUpperCase()}</span>
                {isLocked ? (
                  <span className="mds-badge bg-[var(--mds-amber)]/10 text-[var(--mds-amber)] border-[var(--mds-amber)]/30 font-black uppercase text-[9px] tracking-widest px-3 py-1.5 flex items-center gap-1.5">
                    <Lock size={10} /> Roster locked
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="mds-btn-secondary h-11 w-11 p-0 flex items-center justify-center rounded-xl bg-[var(--mds-input)] border border-[var(--mds-border)] shadow-sm active:scale-95 transition-all shrink-0">
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-8 md:p-10 custom-scrollbar space-y-10">
          {isLocked ? (
            <div className="rounded-xl border border-[var(--mds-amber)]/30 bg-[var(--mds-amber)]/10 px-4 py-3 text-xs text-[var(--mds-text-muted)] leading-relaxed">
              The bracket is in play. Name, nickname, seat and flag corrections are still allowed. Seeding, Steam IDs, leader flags and roster additions/removals need roster edits unlocked in settings.
            </div>
          ) : null}

          {/* TEAM DETAILS */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <Users size={18} className="text-[var(--mds-action)]" />
              <h3 className="text-lg font-black uppercase tracking-tight">Team details</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
              <div className="md:col-span-5 space-y-2">
                <label className={fieldLabel}>Team name</label>
                <input
                  type="text"
                  maxLength={64}
                  value={teamDraft.name}
                  onChange={(e) => setTeamDraft({ ...teamDraft, name: e.target.value })}
                  className={fieldInput}
                  placeholder="Team name"
                />
              </div>
              <div className="md:col-span-5 space-y-2">
                <label className={fieldLabel}>Logo URL</label>
                <input
                  type="text"
                  value={teamDraft.logoUrl}
                  onChange={(e) => setTeamDraft({ ...teamDraft, logoUrl: e.target.value })}
                  className={fieldInput}
                  placeholder="https://... or /uploads/logos/..."
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className={fieldLabel}>Seed</label>
                <input
                  type="number"
                  min={1}
                  disabled={isLocked}
                  value={teamDraft.seed}
                  onChange={(e) => setTeamDraft({ ...teamDraft, seed: e.target.value })}
                  className={`${fieldInput} text-center font-mono disabled:opacity-30`}
                  placeholder="—"
                  title={isLocked ? 'Seeding is locked while the bracket is in play' : undefined}
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={handleSaveTeam}
                disabled={!teamDirty || !teamDraft.name.trim() || busy === 'team'}
                className="mds-btn-primary h-10 px-6 text-[10px] font-black uppercase tracking-widest gap-2 disabled:opacity-30"
              >
                {busy === 'team' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save details
              </button>
            </div>
          </section>

          {/* ROSTER */}
          <section>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-t border-[var(--mds-border)] pt-8">
              <div className="flex items-center gap-3">
                <ShieldCheck size={18} className="text-[var(--mds-action)]" />
                <h3 className="text-lg font-black uppercase tracking-tight">
                  Active roster ({players.length}/{teamSize})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setNewPlayer(EMPTY_PLAYER)}
                disabled={isLocked || atCap || Boolean(newPlayer)}
                title={isLocked ? 'Unlock roster edits to add players' : atCap ? `Roster is full (${teamSize} players)` : undefined}
                className="mds-btn-primary h-10 px-5 text-[10px] font-black uppercase tracking-widest gap-2 shadow-lg shadow-[var(--mds-action)]/20 disabled:opacity-30 disabled:shadow-none"
              >
                <UserPlus size={14} /> Add player
              </button>
            </div>

            <div className="space-y-4">
              {players.map((player: any, idx: number) => {
                const draft = rowFor(player);
                const dirty = rowDirty(player);
                const rowBusy = busy === player.id;
                return (
                  <div key={player.id} className="mds-card bg-[var(--mds-input)]/20 p-5 shadow-md">
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 mt-6 bg-[var(--mds-page)] rounded-xl border border-[var(--mds-border)] flex items-center justify-center text-[var(--mds-action)] font-mono font-black text-[10px] shadow-inner shrink-0">
                        {(idx + 1).toString().padStart(2, '0')}
                      </div>
                      <div className="flex-1 grid grid-cols-2 md:grid-cols-12 gap-4">
                        <div className="col-span-2 md:col-span-3 space-y-2">
                          <label className={fieldLabel}>Name</label>
                          <input
                            type="text"
                            maxLength={64}
                            value={draft.name}
                            onChange={(e) => patchRow(player, { name: e.target.value })}
                            className={fieldInput}
                            placeholder="Full name"
                          />
                        </div>
                        <div className="md:col-span-3 space-y-2">
                          <label className={fieldLabel}>Nickname</label>
                          <input
                            type="text"
                            maxLength={64}
                            value={draft.nickname}
                            onChange={(e) => patchRow(player, { nickname: e.target.value })}
                            className={fieldInput}
                            placeholder="In-game"
                          />
                        </div>
                        <div className="md:col-span-2 space-y-2">
                          <label className={fieldLabel}>Seat</label>
                          <input
                            type="text"
                            maxLength={16}
                            value={draft.seating}
                            onChange={(e) => patchRow(player, { seating: e.target.value })}
                            className={`${fieldInput} font-mono uppercase`}
                            placeholder="A-12"
                          />
                        </div>
                        <div className="md:col-span-1 space-y-2">
                          <label className={fieldLabel}>Flag</label>
                          <input
                            type="text"
                            maxLength={8}
                            value={draft.countryCode}
                            onChange={(e) => patchRow(player, { countryCode: e.target.value.toUpperCase() })}
                            className={`${fieldInput} text-center font-mono`}
                            placeholder="NO"
                          />
                        </div>
                        <div className="col-span-2 md:col-span-3 space-y-2">
                          <label className={fieldLabel}>Steam ID {isLocked ? '(locked)' : ''}</label>
                          <input
                            type="text"
                            maxLength={64}
                            disabled={isLocked}
                            value={draft.steamId}
                            onChange={(e) => patchRow(player, { steamId: e.target.value })}
                            className={`${fieldInput} font-mono disabled:opacity-30`}
                            placeholder="7656119..."
                            title={isLocked ? 'Unlock roster edits to change Steam IDs' : undefined}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--mds-border)]/60 pt-4">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => patchRow(player, { isLeader: !draft.isLeader })}
                          title={isLocked ? 'Unlock roster edits to change the team leader' : undefined}
                          className={`h-9 px-4 flex items-center gap-2 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-30 ${
                            draft.isLeader
                              ? 'bg-[var(--mds-action-soft)] border-[var(--mds-action)]/40 text-[var(--mds-action)]'
                              : 'bg-[var(--mds-input)] border-[var(--mds-border)] text-[var(--mds-text-muted)]'
                          }`}
                        >
                          <Crown size={13} /> {draft.isLeader ? 'Team leader' : 'Not leader'}
                        </button>
                        {player.steamId ? (
                          <a
                            href={`https://steamcommunity.com/profiles/${player.steamId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-9 px-4 flex items-center justify-center bg-[var(--mds-input)] border border-[var(--mds-border)] rounded-lg text-[10px] font-black uppercase tracking-widest hover:border-[var(--mds-action)]/40 transition-all shadow-sm"
                          >
                            Steam
                          </a>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        {dirty ? (
                          <button
                            type="button"
                            onClick={() => clearRow(player.id)}
                            className="h-9 px-4 rounded-lg bg-[var(--mds-input)] border border-[var(--mds-border)] text-[10px] font-black uppercase tracking-widest text-[var(--mds-text-muted)] hover:border-[var(--mds-action)]/30 transition-all"
                          >
                            Revert
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => handleSaveRow(player)}
                          disabled={!dirty || !draft.name.trim() || rowBusy}
                          className="mds-btn-primary h-9 px-5 text-[10px] font-black uppercase tracking-widest gap-2 disabled:opacity-30"
                        >
                          {rowBusy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
                        </button>
                        <button
                          type="button"
                          disabled={isLocked || rowBusy}
                          onClick={() => handleDeleteRow(player)}
                          title={isLocked ? 'Unlock roster edits to remove players' : `Remove ${player.name}`}
                          aria-label={`Remove ${player.name}`}
                          className="h-9 w-9 flex items-center justify-center bg-[var(--mds-input)] border border-[var(--mds-border)] rounded-lg hover:text-[var(--mds-red)] hover:border-[var(--mds-red)]/40 transition-all shadow-sm disabled:opacity-30"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {newPlayer ? (
                <div className="mds-card border-[var(--mds-action)]/30 bg-[var(--mds-action-soft)]/40 p-5 shadow-md">
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 mt-6 bg-[var(--mds-page)] rounded-xl border border-[var(--mds-action)]/30 flex items-center justify-center text-[var(--mds-action)] shrink-0">
                      <UserPlus size={16} />
                    </div>
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-12 gap-4">
                      <div className="col-span-2 md:col-span-3 space-y-2">
                        <label className={fieldLabel}>Name</label>
                        <input
                          autoFocus
                          type="text"
                          maxLength={64}
                          value={newPlayer.name}
                          onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
                          className={fieldInput}
                          placeholder="Full name"
                        />
                      </div>
                      <div className="md:col-span-3 space-y-2">
                        <label className={fieldLabel}>Nickname</label>
                        <input
                          type="text"
                          maxLength={64}
                          value={newPlayer.nickname}
                          onChange={(e) => setNewPlayer({ ...newPlayer, nickname: e.target.value })}
                          className={fieldInput}
                          placeholder="In-game"
                        />
                      </div>
                      <div className="md:col-span-2 space-y-2">
                        <label className={fieldLabel}>Seat</label>
                        <input
                          type="text"
                          maxLength={16}
                          value={newPlayer.seating}
                          onChange={(e) => setNewPlayer({ ...newPlayer, seating: e.target.value })}
                          className={`${fieldInput} font-mono uppercase`}
                          placeholder="A-12"
                        />
                      </div>
                      <div className="md:col-span-1 space-y-2">
                        <label className={fieldLabel}>Flag</label>
                        <input
                          type="text"
                          maxLength={8}
                          value={newPlayer.countryCode}
                          onChange={(e) => setNewPlayer({ ...newPlayer, countryCode: e.target.value.toUpperCase() })}
                          className={`${fieldInput} text-center font-mono`}
                          placeholder="NO"
                        />
                      </div>
                      <div className="col-span-2 md:col-span-3 space-y-2">
                        <label className={fieldLabel}>Steam ID</label>
                        <input
                          type="text"
                          maxLength={64}
                          value={newPlayer.steamId}
                          onChange={(e) => setNewPlayer({ ...newPlayer, steamId: e.target.value })}
                          className={`${fieldInput} font-mono`}
                          placeholder="Optional"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-end gap-2 border-t border-[var(--mds-border)]/60 pt-4">
                    <button
                      type="button"
                      onClick={() => setNewPlayer(null)}
                      className="h-9 px-4 rounded-lg bg-[var(--mds-input)] border border-[var(--mds-border)] text-[10px] font-black uppercase tracking-widest text-[var(--mds-text-muted)] hover:border-[var(--mds-action)]/30 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddPlayer}
                      disabled={!newPlayer.name.trim() || busy === 'new'}
                      className="mds-btn-primary h-9 px-5 text-[10px] font-black uppercase tracking-widest gap-2 disabled:opacity-30"
                    >
                      {busy === 'new' ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />} Add to roster
                    </button>
                  </div>
                </div>
              ) : null}

              {players.length === 0 && !newPlayer ? (
                <div className="py-24 text-center border-2 border-dashed border-[var(--mds-border)] rounded-xl bg-[var(--mds-input)]/10 opacity-40">
                  <Users size={30} className="mx-auto mb-4 opacity-40" />
                  <p className="mds-uppercase-label text-[11px] font-black uppercase tracking-widest">No players on this roster</p>
                  <p className="text-[10px] font-bold mt-1 text-[var(--mds-text-subtle)] uppercase">
                    {isLocked ? 'Unlock roster edits to add players' : 'Use “Add player” to build the roster'}
                  </p>
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <footer className="px-8 py-6 border-t border-[var(--mds-border)] bg-[var(--mds-input)]/20 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="mds-uppercase-label text-[9px] font-black uppercase tracking-widest opacity-40">
            {teamDirty || Object.keys(playerDrafts).length > 0 || newPlayer
              ? 'Unsaved changes — use the Save buttons above'
              : 'All changes saved'}
          </div>
          <button onClick={onClose} className="mds-btn-secondary h-11 px-10 text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all">
            Close
          </button>
        </footer>
      </div>
    </div>
  );
};
