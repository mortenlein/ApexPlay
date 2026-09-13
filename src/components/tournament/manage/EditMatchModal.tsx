'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { X, Save, RefreshCw, Send, CheckCircle2, History, Clock, Flag, Trophy, Activity, Play } from 'lucide-react';

interface EditMatchModalProps {
  match: any;
  onClose: () => void;
  matchForm: any;
  setMatchForm: (form: any) => void;
  onSaveMatch: (e: React.FormEvent) => void;
  onForfeit: (side: 'HOME' | 'AWAY') => void;
  onAnnounceDiscord: (match: any, type: 'START' | 'RESULT') => void;
  onLoadMatch: (matchId: string) => Promise<void>;
  isSaving: boolean;
  isLoadingMatch: boolean;
  /**
   * How a human identifies this match — its place in the draw ("Semi-Final"), worked out by the
   * workspace because it needs the whole bracket to do so. The uuid is an implementation detail
   * and is never shown.
   */
  stageName: string;
}

export const EditMatchModal: React.FC<EditMatchModalProps> = ({
  match,
  onClose,
  matchForm,
  setMatchForm,
  onSaveMatch,
  onForfeit,
  onAnnounceDiscord,
  onLoadMatch,
  isSaving,
  isLoadingMatch,
  stageName,
}) => {
  const t = useTranslations('organizer.matchModal');
  const tConfirm = useTranslations('organizer.confirm');
  const tStatus = useTranslations('status');
  const tCommon = useTranslations('common');
  const [announcing, setAnnouncing] = useState(false);
  const bothTeamsAssigned = Boolean(match.homeTeam && match.awayTeam);
  const isForfeit = match.resultType === 'FORFEIT';

  const handleAnnounce = async (type: 'START' | 'RESULT') => {
    setAnnouncing(true);
    try {
      await onAnnounceDiscord(match, type);
    } finally {
      setAnnouncing(false);
    }
  };

  const handleForfeit = (side: 'HOME' | 'AWAY') => {
    const forfeiting = side === 'HOME' ? match.homeTeam?.name : match.awayTeam?.name;
    const advancing = side === 'HOME' ? match.awayTeam?.name : match.homeTeam?.name;
    const confirmed = window.confirm(tConfirm('forfeit', { forfeiting, advancing }));
    if (!confirmed) return;
    onForfeit(side);
  };

  const actionButton = 'flex h-11 flex-1 min-w-[150px] items-center justify-center gap-2 rounded-lg border text-sm font-bold transition-all disabled:opacity-50';

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-[var(--mds-overlay)] backdrop-blur-md" onClick={onClose}></div>
      {/* Capped at 92vh with the save pinned below the scroll area: on a 1280x720 laptop the
          organizer must still be able to reach "Update Match Data". */}
      <div className="mds-card relative z-10 flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden p-0 shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-[var(--mds-border)] bg-[var(--mds-input)]/20 px-6 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg font-bold tracking-tight">{t('title')}</h2>
              {isForfeit && (
                <span className="mds-badge flex items-center gap-1.5 border border-[var(--mds-red)]/30 bg-[var(--mds-red)]/10 text-[var(--mds-red)]">
                  <Flag size={10} /> {t('forfeitBadge')}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-[var(--mds-text-muted)]">
              {t('subtitle', { stage: stageName, bestOf: matchForm.bestOf || 1 })}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={tCommon('close')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-[var(--mds-border)] bg-white/5 text-[var(--mds-text-primary)] transition-colors hover:bg-white/10"
          >
            <X size={18} />
          </button>
        </header>

        <form id="edit-match-form" onSubmit={onSaveMatch} className="custom-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
          {/* STATUS SELECTOR */}
          <div className="space-y-2">
            <label className="mds-uppercase-label">{t('status')}</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {/* READY and LIVE read from the shared status vocabulary; PENDING and COMPLETED are
                  spelled for the editor ("Not called" / "Final"), which is a choice this surface
                  makes and the badges deliberately do not. */}
              {[
                { id: 'PENDING', label: t('statusNotCalled'), color: 'var(--mds-text-subtle)', icon: Clock },
                { id: 'READY', label: tStatus('called'), color: 'var(--mds-green)', icon: History },
                { id: 'LIVE', label: tStatus('live'), color: 'var(--mds-red)', icon: Activity },
                { id: 'COMPLETED', label: t('statusFinal'), color: 'var(--mds-text-muted)', icon: CheckCircle2 }
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setMatchForm({ ...matchForm, status: s.id })}
                  className={`flex items-center justify-center gap-2 rounded-lg border-2 p-3 transition-all ${
                    matchForm.status === s.id
                      ? 'border-[var(--mds-action)] bg-[var(--mds-action-soft)] text-[var(--mds-text-primary)]'
                      : 'border-[var(--mds-border)] bg-[var(--mds-input)] text-[var(--mds-text-muted)] hover:border-[var(--mds-border-hover)]'
                  }`}
                >
                  <s.icon size={15} style={{ color: matchForm.status === s.id ? s.color : 'inherit' }} />
                  <span className="text-sm font-bold">{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* SCORE INPUT — the reason the editor is open most of the time. */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-4 rounded-lg border border-[var(--mds-border)] bg-[var(--mds-input)]/40 p-5">
            <div className="space-y-2 text-center">
              <label className="mds-uppercase-label" htmlFor="home-score">{t('home')}</label>
              <div className="mds-name text-sm">{match.homeTeam?.name || tCommon('tbd')}</div>
              <input
                id="home-score"
                type="number"
                value={matchForm.homeScore}
                onChange={(e) => setMatchForm({ ...matchForm, homeScore: parseInt(e.target.value) || 0 })}
                className="mds-input mds-numeric h-14 text-center text-2xl font-bold"
              />
            </div>

            <div className="mds-uppercase-label pt-9 text-[var(--mds-text-subtle)]">{t('vs')}</div>

            <div className="space-y-2 text-center">
              <label className="mds-uppercase-label" htmlFor="away-score">{t('away')}</label>
              <div className="mds-name text-sm">{match.awayTeam?.name || tCommon('tbd')}</div>
              <input
                id="away-score"
                type="number"
                value={matchForm.awayScore}
                onChange={(e) => setMatchForm({ ...matchForm, awayScore: parseInt(e.target.value) || 0 })}
                className="mds-input mds-numeric h-14 text-center text-2xl font-bold"
              />
            </div>
          </div>

          {/* MAP SCORES (Conditional) */}
          {matchForm.bestOf > 1 && (
            <div className="space-y-2">
              <label className="mds-uppercase-label">{t('mapScores')}</label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[...Array(matchForm.bestOf)].map((_, i) => {
                  const score = (matchForm.mapScores || [])[i] || { home: 0, away: 0, map: '' };
                  return (
                    <div key={i} className="space-y-2 rounded-lg border border-[var(--mds-border)] bg-[var(--mds-input)] p-3">
                      <span className="mds-uppercase-label text-[var(--mds-text-subtle)]">{t('map', { n: i + 1 })}</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          aria-label={t('mapHomeScore', { n: i + 1 })}
                          value={score.home}
                          onChange={(e) => {
                            const newScores = [...(matchForm.mapScores || [])];
                            newScores[i] = { ...score, home: parseInt(e.target.value) || 0 };
                            setMatchForm({ ...matchForm, mapScores: newScores });
                          }}
                          className="mds-input mds-numeric h-9 w-full px-2 text-center text-sm font-bold"
                        />
                        <span className="text-xs text-[var(--mds-text-subtle)]">:</span>
                        <input
                          type="number"
                          aria-label={t('mapAwayScore', { n: i + 1 })}
                          value={score.away}
                          onChange={(e) => {
                            const newScores = [...(matchForm.mapScores || [])];
                            newScores[i] = { ...score, away: parseInt(e.target.value) || 0 };
                            setMatchForm({ ...matchForm, mapScores: newScores });
                          }}
                          className="mds-input mds-numeric h-9 w-full px-2 text-center text-sm font-bold"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SETTINGS & ACTIONS */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <label className="mds-uppercase-label" htmlFor="series-length">{t('seriesLength')}</label>
              <select
                id="series-length"
                value={matchForm.bestOf}
                onChange={(e) => setMatchForm({ ...matchForm, bestOf: parseInt(e.target.value) })}
                className="mds-input h-11 text-sm font-semibold"
              >
                <option value={1}>{t('bo1')}</option>
                <option value={3}>{t('bo3')}</option>
                <option value={5}>{t('bo5')}</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="mds-uppercase-label">{t('actions')}</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onLoadMatch(match.id)}
                  disabled={isLoadingMatch}
                  data-testid="start-match-button"
                  className={`${actionButton} border-[var(--mds-action)]/30 text-[var(--mds-action)] hover:border-[var(--mds-action)] hover:bg-[var(--mds-action)]/10`}
                >
                  {isLoadingMatch ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
                  {t('startMatch')}
                </button>
                <button
                  type="button"
                  onClick={() => handleAnnounce('START')}
                  disabled={announcing}
                  data-testid="notify-players-button"
                  className={`${actionButton} border-[#5865F2]/30 text-[#5865F2] hover:border-[#5865F2] hover:bg-[#5865F2]/10`}
                >
                  <Send size={14} /> {t('notifyPlayers')}
                </button>
                <button
                  type="button"
                  onClick={() => handleAnnounce('RESULT')}
                  disabled={announcing}
                  className={`${actionButton} border-[var(--mds-green)]/30 text-[var(--mds-green)] hover:border-[var(--mds-green)] hover:bg-[var(--mds-green)]/10`}
                >
                  <Trophy size={14} /> {t('sendResult')}
                </button>
              </div>
            </div>
          </div>

          {/* FORFEIT / WALKOVER */}
          <div className="space-y-2">
            <label className="mds-uppercase-label">{t('forfeit')}</label>
            <div className="flex flex-wrap gap-2">
              {(['HOME', 'AWAY'] as const).map((side) => (
                <button
                  key={side}
                  type="button"
                  onClick={() => handleForfeit(side)}
                  disabled={!bothTeamsAssigned || isSaving}
                  data-testid={`forfeit-${side.toLowerCase()}-button`}
                  className={`${actionButton} border-[var(--mds-red)]/30 text-[var(--mds-red)] hover:border-[var(--mds-red)] hover:bg-[var(--mds-red)]/10 disabled:hover:border-[var(--mds-red)]/30 disabled:hover:bg-transparent`}
                >
                  <Flag size={14} />
                  {t(side === 'HOME' ? 'homeForfeits' : 'awayForfeits')}
                </button>
              ))}
            </div>
            <p className="text-xs text-[var(--mds-text-subtle)]">
              {t(bothTeamsAssigned ? 'forfeitHint' : 'forfeitBlocked')}
            </p>
          </div>
        </form>

        {/* Save lives outside the scroll area so it is always reachable, whatever the window height. */}
        <footer className="border-t border-[var(--mds-border)] bg-[var(--mds-input)]/10 px-6 py-4">
          <button
            type="submit"
            form="edit-match-form"
            disabled={isSaving}
            className="mds-btn-primary h-12 w-full gap-2 text-sm font-bold"
          >
            {isSaving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
            {t('save')}
          </button>
        </footer>
      </div>
    </div>
  );
};
