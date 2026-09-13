'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { AlertTriangle, Check, ChevronRight, ChevronLeft, Trophy, X, Copy, Loader2, Plus, Zap } from 'lucide-react';
import {
    BO3_STAGES,
    BO5_STAGES,
    FORMAT_OPTIONS,
    STAGE_LABELS,
    SUPPORTED_GAMES,
    defaultTeamSize,
    stageLabel,
    teamSizeLabel,
} from '@/lib/games';

interface TournamentWizardProps {
    onClose: () => void;
    onComplete: (data: any) => Promise<string | void>;
}

/** The six step headings, in order — keyed so the wizard chrome and the step body share one name. */
const STEP_KEYS = ['step1', 'step2', 'step3', 'step4', 'step5', 'step6'] as const;

/**
 * Format and game-type labels live in `@/lib/games` as stable ids; these map them onto the
 * organizer catalogue so a Norwegian arrangør never reads a raw English constant.
 */
const FORMAT_KEYS: Record<string, { name: string; desc: string }> = {
    SINGLE_ELIMINATION: { name: 'formatSingleName', desc: 'formatSingleDesc' },
    DOUBLE_ELIMINATION: { name: 'formatDoubleName', desc: 'formatDoubleDesc' },
};
const GAME_TYPE_KEYS: Record<string, string> = { Tactical: 'gameTypeTactical', Royale: 'gameTypeRoyale' };

/** Step heading + one line of context. The heading is furniture, so it may shout; nothing else does. */
function StepHeader({ title, hint }: { title: string; hint: string }) {
    return (
        <div>
            <h3 className="font-brand text-xl font-bold tracking-tight">{title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-[var(--mds-text-muted)]">{hint}</p>
        </div>
    );
}

export default function TournamentWizard({ onClose, onComplete }: TournamentWizardProps) {
    const t = useTranslations('organizer.wizard');
    const tCommon = useTranslations('common');
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        name: '',
        game: '',
        format: 'SINGLE_ELIMINATION',
        teamSize: '5',
        hasThirdPlace: false,
        // "Last N rounds" from the final: 0 = off (BO1 default). See STAGE_OPTIONS below.
        bo3LastRounds: '0',
        bo5LastRounds: '0',
    });
    const [createdId, setCreatedId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const selectedGame = SUPPORTED_GAMES.find(g => g.id === formData.game);
    const selectedFormat = FORMAT_OPTIONS.find(f => f.id === formData.format);
    const nextStep = () => setStep(s => Math.min(s + 1, 6));
    const prevStep = () => setStep(s => Math.max(s - 1, 1));

    // Stepping back and picking a different game can leave a team size the new game does not
    // support - snap it back to that game's default so the server never sees a mismatch.
    useEffect(() => {
        if (!selectedGame) return;
        if (selectedGame.teamSize.includes(Number.parseInt(formData.teamSize, 10))) return;
        setFormData(prev => ({ ...prev, teamSize: String(defaultTeamSize(selectedGame)) }));
    }, [selectedGame, formData.teamSize]);

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setSubmitError(null);
        try {
            const id = await onComplete(formData);
            if (id) {
                setCreatedId(id);
                setStep(6);
            }
        } catch (error) {
            // The parent toasts as well, but keep the organizer on the review step with the reason.
            setSubmitError(error instanceof Error ? error.message : t('createFailed'));
            setStep(5);
        } finally {
            setIsSubmitting(false);
        }
    };

    const copyLink = () => {
        const url = `${window.location.origin}/tournaments/${createdId}`;
        navigator.clipboard.writeText(url);
    };

    const optionCard = (selected: boolean) =>
        `rounded-lg border-2 p-4 text-left transition-all ${
            selected
                ? 'border-[var(--mds-action)] bg-[var(--mds-action)]/10'
                : 'border-[var(--mds-border)] bg-[var(--mds-input)]/20 hover:border-[var(--mds-action)]/40'
        }`;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-[var(--mds-overlay)] backdrop-blur-sm" onClick={onClose} />

            {/* 92vh with the step controls pinned below the scroll area: at 1280x720 the organizer
                must still be able to reach Continue / Create. */}
            <div className="mds-card relative z-10 flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden p-0 shadow-2xl">
                <div className="h-1 w-full bg-[var(--mds-input)]">
                    <div
                        className="h-full bg-[var(--mds-action)] transition-all duration-500"
                        style={{ width: `${(step / 6) * 100}%` }}
                    />
                </div>

                <header className="flex items-center justify-between gap-4 border-b border-[var(--mds-border)] bg-[var(--mds-input)]/20 px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--mds-action)]/20 bg-[var(--mds-action-soft)] text-[var(--mds-action)]">
                            <Plus size={18} />
                        </div>
                        <div>
                            <h2 className="text-base font-bold tracking-tight">{t('heading')}</h2>
                            <p className="mds-uppercase-label">
                                {t('progress', { step, total: 6, title: t(STEP_KEYS[step - 1]) })}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} aria-label={tCommon('close')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-[var(--mds-border)] bg-white/5 text-[var(--mds-text-primary)] transition-colors hover:bg-white/10">
                        <X size={18} />
                    </button>
                </header>

                <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-6">
                    {/* STEP 1: GAME SELECTION */}
                    {step === 1 && (
                        <div className="space-y-5">
                            <StepHeader title={t('step1')} hint={t('gameHint')} />
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                {SUPPORTED_GAMES.map((game) => (
                                    <button
                                        key={game.id}
                                        onClick={() => { setFormData({ ...formData, game: game.id, teamSize: String(defaultTeamSize(game)) }); nextStep(); }}
                                        className={`group relative h-32 overflow-hidden rounded-lg border-2 text-left transition-all ${formData.game === game.id ? 'border-[var(--mds-action)]' : 'border-[var(--mds-border)] hover:border-[var(--mds-action)]/40'}`}
                                    >
                                        <Image
                                            src={game.bannerUrl}
                                            fill
                                            sizes="400px"
                                            className="object-cover opacity-10 transition-opacity duration-500 group-hover:opacity-20"
                                            alt=""
                                        />
                                        <div className="absolute inset-0 flex flex-col justify-end p-4">
                                            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--mds-border)] bg-[var(--mds-card)] p-1.5">
                                                <Image src={game.logoUrl} width={20} height={20} className="object-contain" alt="" />
                                            </div>
                                            <span className="mds-name text-base">{game.name}</span>
                                            <span className="mds-uppercase-label">
                                                {GAME_TYPE_KEYS[game.type] ? t(GAME_TYPE_KEYS[game.type]) : game.type}
                                            </span>
                                        </div>
                                        {formData.game === game.id && (
                                            <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--mds-action)]">
                                                <Check size={11} className="text-white" />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* STEP 2: IDENTITY */}
                    {step === 2 && (
                        <div className="space-y-5">
                            <StepHeader title={t('step2')} hint={t('detailsHint')} />
                            <div className="space-y-1.5">
                                <label className="mds-uppercase-label" htmlFor="wizard-name">{t('nameLabel')}</label>
                                <input
                                    id="wizard-name"
                                    autoFocus
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    onKeyDown={(e) => e.key === 'Enter' && formData.name && nextStep()}
                                    className="mds-input mds-name h-12 px-4 text-base"
                                    placeholder={t('namePlaceholder')}
                                />
                            </div>
                        </div>
                    )}

                    {/* STEP 3: FORMAT */}
                    {step === 3 && (
                        <div className="space-y-5">
                            <StepHeader title={t('step3')} hint={t('formatHint')} />
                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                <div className="space-y-2">
                                    <label className="mds-uppercase-label">{t('bracketStyle')}</label>
                                    {FORMAT_OPTIONS.map(f => (
                                        <button
                                            key={f.id}
                                            onClick={() => setFormData({ ...formData, format: f.id })}
                                            className={`w-full ${optionCard(formData.format === f.id)}`}
                                        >
                                            <div className="text-sm font-bold">{t(FORMAT_KEYS[f.id].name)}</div>
                                            <div className="mt-0.5 text-xs text-[var(--mds-text-muted)]">{t(FORMAT_KEYS[f.id].desc)}</div>
                                        </button>
                                    ))}
                                </div>

                                <div className="space-y-2">
                                    <label className="mds-uppercase-label">{t('teamSize')}</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {selectedGame?.teamSize.map(size => (
                                            <button
                                                key={size}
                                                onClick={() => setFormData({ ...formData, teamSize: String(size) })}
                                                className={`text-center text-base font-bold ${optionCard(formData.teamSize === String(size))}`}
                                            >
                                                {teamSizeLabel(selectedGame, size)}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="mds-card flex items-center justify-between gap-4 bg-[var(--mds-input)]/20 p-4">
                                        <div>
                                            <div className="text-sm font-semibold">{t('thirdPlace')}</div>
                                            <div className="mt-0.5 text-xs text-[var(--mds-text-muted)]">{t('thirdPlaceHint')}</div>
                                        </div>
                                        <button
                                            aria-label={t('toggleThirdPlace')}
                                            aria-pressed={formData.hasThirdPlace}
                                            onClick={() => setFormData({ ...formData, hasThirdPlace: !formData.hasThirdPlace })}
                                            className={`relative h-6 w-11 shrink-0 rounded-full transition-all ${formData.hasThirdPlace ? 'bg-[var(--mds-action)]' : 'bg-gray-700'}`}
                                        >
                                            <div className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${formData.hasThirdPlace ? 'left-6' : 'left-1'}`} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 4: SERIES SETTINGS */}
                    {step === 4 && (
                        <div className="space-y-5">
                            <StepHeader title={t('step4')} hint={t('seriesHint')} />

                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                <div className="space-y-1.5">
                                    <label className="mds-uppercase-label" htmlFor="wizard-bo3">{t('bo3From')}</label>
                                    <div className="relative">
                                        <select
                                            id="wizard-bo3"
                                            value={formData.bo3LastRounds}
                                            onChange={(e) => setFormData({ ...formData, bo3LastRounds: e.target.value })}
                                            className="mds-input h-11 cursor-pointer appearance-none px-4 pr-10 text-sm font-semibold"
                                        >
                                            {BO3_STAGES.map((v) => (
                                                <option key={v} value={String(v)}>{STAGE_LABELS[v]}</option>
                                            ))}
                                        </select>
                                        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 opacity-40">
                                            <ChevronRight size={15} className="rotate-90" />
                                        </div>
                                    </div>
                                    <p className="text-xs leading-relaxed text-[var(--mds-text-subtle)]">{t('bo3Help')}</p>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="mds-uppercase-label" htmlFor="wizard-bo5">{t('bo5From')}</label>
                                    <div className="relative">
                                        <select
                                            id="wizard-bo5"
                                            value={formData.bo5LastRounds}
                                            onChange={(e) => setFormData({ ...formData, bo5LastRounds: e.target.value })}
                                            className="mds-input h-11 cursor-pointer appearance-none px-4 pr-10 text-sm font-semibold"
                                        >
                                            {BO5_STAGES.map((v) => (
                                                <option key={v} value={String(v)}>{STAGE_LABELS[v]}</option>
                                            ))}
                                        </select>
                                        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 opacity-40">
                                            <ChevronRight size={15} className="rotate-90" />
                                        </div>
                                    </div>
                                    <p className="text-xs leading-relaxed text-[var(--mds-text-subtle)]">{t('bo5Help')}</p>
                                </div>
                            </div>
                            <div className="mds-card flex items-start gap-3 border-[var(--mds-action)]/20 bg-[var(--mds-action-soft)] p-4">
                                <Zap size={16} className="mt-0.5 shrink-0 text-[var(--mds-action)]" />
                                <p className="text-sm leading-relaxed text-[var(--mds-text-muted)]">{t('seriesNote')}</p>
                            </div>
                        </div>
                    )}

                    {/* STEP 5: REVIEW */}
                    {step === 5 && (
                        <div className="space-y-5">
                            <StepHeader title={t('step5')} hint={t('reviewHint')} />
                            <div className="mds-card space-y-5 bg-[var(--mds-input)]/20 p-5">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-[var(--mds-border)] bg-[var(--mds-page)] p-2.5">
                                        {selectedGame && <Image src={selectedGame.logoUrl} width={36} height={36} className="object-contain" alt="" />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h4 className="mds-name-lg text-xl">{formData.name}</h4>
                                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                            <span className="mds-badge bg-[var(--mds-action-soft)] text-[var(--mds-action)]">{selectedGame?.name}</span>
                                            <span className="mds-badge border border-[var(--mds-border)] bg-[var(--mds-input)] text-[var(--mds-text-subtle)]">
                                                {selectedFormat ? t(FORMAT_KEYS[selectedFormat.id].name) : ''}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 border-t border-[var(--mds-border)] pt-5 lg:grid-cols-4">
                                    {[
                                        { label: t('reviewFormat'), value: t(formData.format === 'SINGLE_ELIMINATION' ? 'reviewFormatSingle' : 'reviewFormatDouble') },
                                        { label: t('reviewDecider'), value: t(formData.hasThirdPlace ? 'reviewDeciderOn' : 'reviewDeciderOff') },
                                        { label: t('reviewTeamSize'), value: teamSizeLabel(selectedGame, Number.parseInt(formData.teamSize, 10)) },
                                        { label: t('reviewBo3'), value: stageLabel(Number.parseInt(formData.bo3LastRounds, 10)) },
                                        { label: t('reviewBo5'), value: stageLabel(Number.parseInt(formData.bo5LastRounds, 10)) },
                                    ].map(item => (
                                        <div key={item.label}>
                                            <p className="mds-uppercase-label">{item.label}</p>
                                            <p className="mt-1 text-sm font-semibold">{item.value}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {submitError && (
                                <div className="flex items-start gap-3 rounded-lg border border-[var(--mds-red)]/30 bg-[var(--mds-red)]/5 p-4" role="alert">
                                    <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[var(--mds-red)]" />
                                    <p className="text-sm leading-relaxed text-[var(--mds-red)]">{submitError}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 6: SUCCESS */}
                    {step === 6 && (
                        <div className="space-y-6 py-4 text-center">
                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-[var(--mds-action)] bg-[var(--mds-action-soft)]">
                                <Trophy size={28} className="text-[var(--mds-action)]" />
                            </div>
                            <div>
                                <h3 className="font-brand text-2xl font-bold tracking-tight">{t('step6')}</h3>
                                <p className="mt-1.5 text-sm text-[var(--mds-text-muted)]">
                                    {t.rich('createdLine', {
                                        name: formData.name,
                                        b: (chunks) => <span className="mds-name">{chunks}</span>,
                                    })}
                                </p>
                            </div>

                            <div className="mx-auto max-w-md space-y-4">
                                <div className="rounded-lg border border-[var(--mds-border)] bg-[var(--mds-input)]/40 p-4 text-left">
                                    <p className="mds-uppercase-label">{t('registrationLink')}</p>
                                    <div className="mt-2 flex gap-2">
                                        <div className="flex-1 truncate rounded-lg border border-[var(--mds-border)] bg-[var(--mds-page)] px-3 py-2.5 text-left font-mono text-xs text-[var(--mds-action)]">
                                            {typeof window !== 'undefined' ? `${window.location.host}/tournaments/${createdId}` : ''}
                                        </div>
                                        <button onClick={copyLink} aria-label={t('copyRegistrationLink')} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm bg-[var(--mds-action)] text-white transition-colors hover:bg-[var(--mds-action-hover)]">
                                            <Copy size={16} />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3 sm:flex-row">
                                    <button onClick={onClose} className="mds-btn-secondary h-11 flex-1 px-6 text-sm font-bold">
                                        {tCommon('close')}
                                    </button>
                                    <button
                                        onClick={() => window.location.href = `/admin/tournaments/${createdId}?tab=participants`}
                                        className="mds-btn-primary h-11 flex-1 px-6 text-sm font-bold"
                                    >
                                        {t('addTeams')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* FOOTER CONTROLS */}
                {step < 6 && (
                    <div className="flex shrink-0 items-center justify-end gap-4 border-t border-[var(--mds-border)] bg-[var(--mds-input)]/30 px-6 py-4">
                        <div className="flex w-full gap-3 sm:w-auto">
                            {step > 1 && (
                                <button onClick={prevStep} className="mds-btn-secondary h-11 flex-1 gap-2 px-6 text-sm font-bold sm:flex-initial">
                                    <ChevronLeft size={15} /> {tCommon('back')}
                                </button>
                            )}
                            {step < 5 ? (
                                <button
                                    disabled={(step === 1 && !formData.game) || (step === 2 && !formData.name)}
                                    onClick={nextStep}
                                    className="mds-btn-primary h-11 flex-1 gap-2 px-8 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-30 sm:flex-initial"
                                >
                                    {t('continue')} <ChevronRight size={15} />
                                </button>
                            ) : (
                                <button
                                    disabled={isSubmitting}
                                    onClick={handleSubmit}
                                    className="mds-btn-primary h-11 min-w-[190px] flex-1 gap-2 px-8 text-sm font-bold disabled:opacity-30 sm:flex-initial"
                                >
                                    {isSubmitting ? (
                                        <><Loader2 size={15} className="animate-spin" /> {t('creating')}</>
                                    ) : (
                                        <><Trophy size={15} /> {t('heading')}</>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
