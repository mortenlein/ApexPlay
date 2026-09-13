'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Loader2, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui';
import { clientApi } from '@/lib/client-api';
import { useToast } from '@/components/ToastProvider';

/** Max length of Player.seating accepted by PATCH /api/me/player. */
export const SEAT_MAX_LENGTH = 16;

/**
 * Inline "your seat" editor for the signed-in player's own Player row in one tournament.
 * Talks to PATCH /api/me/player, which works even after the roster is locked — seats move
 * around on the LAN floor long after the bracket is generated.
 *
 * `size="lg"` is the call-board display: the seat is the number a player reads off their phone
 * while walking to the station, so it is set in the numeric style at display size.
 */
export function SeatEditor({
    tournamentId,
    seating,
    onSaved,
    size = 'sm',
    className = '',
}: {
    tournamentId: string;
    seating?: string | null;
    onSaved?: (seating: string | null) => void;
    size?: 'sm' | 'lg';
    className?: string;
}) {
    const t = useTranslations('player');
    const tCommon = useTranslations('common');
    const toast = useToast();
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(seating || '');
    const [saving, setSaving] = useState(false);

    const save = async () => {
        setSaving(true);
        try {
            const { player } = await clientApi.updateMyPlayer({ tournamentId, seating: value });
            onSaved?.(player?.seating ?? null);
            setValue(player?.seating || '');
            setEditing(false);
            toast.success(
                player?.seating
                    ? t('seat.savedTitle', { seat: player.seating })
                    : t('seat.clearedTitle'),
                player?.seating ? t('seat.savedHint') : undefined
            );
        } catch (error: any) {
            toast.error(t('seat.errorTitle'), error?.message || t('seat.errorHint'));
        } finally {
            setSaving(false);
        }
    };

    const startEditing = (event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        setValue(seating || '');
        setEditing(true);
    };

    if (!editing) {
        // The seat is a value, not a label: tabular figures, no tracking, never wrapped.
        return (
            <div
                className={`flex ${size === 'lg' ? 'flex-wrap items-baseline gap-x-3 gap-y-1' : 'items-center gap-2'} ${className}`}
            >
                {seating ? (
                    <span
                        className={
                            size === 'lg'
                                ? 'mds-numeric text-4xl font-bold leading-none sm:text-5xl'
                                : 'mds-numeric text-sm font-bold'
                        }
                    >
                        {seating}
                    </span>
                ) : (
                    <span className={size === 'lg' ? 'text-sm text-fg-muted' : 'text-xs text-fg-subtle'}>
                        {t('seat.none')}
                    </span>
                )}
                <Button type="button" variant="ghost" size="sm" onClick={startEditing}>
                    <Pencil size={12} />
                    {seating ? tCommon('edit') : t('seat.set')}
                </Button>
            </div>
        );
    }

    return (
        <div className={`space-y-1.5 ${className}`}>
            <div className="flex flex-wrap items-center gap-2">
                <input
                    autoFocus
                    value={value}
                    maxLength={SEAT_MAX_LENGTH}
                    placeholder={t('seat.placeholder')}
                    aria-label={t('seat.label')}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => setValue(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            void save();
                        }
                        if (event.key === 'Escape') {
                            event.preventDefault();
                            setEditing(false);
                        }
                    }}
                    className="mds-input mds-numeric h-9 w-28 px-3 text-sm font-bold"
                />
                <Button
                    type="button"
                    size="sm"
                    disabled={saving}
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        void save();
                    }}
                >
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                    {tCommon('save')}
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={t('seat.cancelAria')}
                    disabled={saving}
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setEditing(false);
                    }}
                >
                    <X size={12} />
                </Button>
            </div>
            <p className="text-xs text-fg-subtle">{t('seat.helper')}</p>
        </div>
    );
}
