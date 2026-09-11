'use client';

import { useState } from 'react';
import { Check, Hash, Loader2, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui';
import { clientApi } from '@/lib/client-api';
import { useToast } from '@/components/ToastProvider';

/** Max length of Player.seating accepted by PATCH /api/me/player. */
export const SEAT_MAX_LENGTH = 16;

export const SEAT_HELPER_TEXT = 'Marshals use this to find you. You can change it later.';

/**
 * Inline "your seat" editor for the signed-in player's own Player row in one tournament.
 * Talks to PATCH /api/me/player, which works even after the roster is locked — seats move
 * around on the LAN floor long after the bracket is generated.
 */
export function SeatEditor({
    tournamentId,
    seating,
    onSaved,
    className = '',
}: {
    tournamentId: string;
    seating?: string | null;
    onSaved?: (seating: string | null) => void;
    className?: string;
}) {
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
                player?.seating ? `Seat saved: ${player.seating}` : 'Seat cleared',
                player?.seating ? 'Marshals can now find you on the floor.' : undefined
            );
        } catch (error: any) {
            toast.error('Could not save your seat', error?.message || 'Please try again.');
        } finally {
            setSaving(false);
        }
    };

    if (!editing) {
        return (
            <div className={`flex items-center gap-2 ${className}`}>
                <Hash size={13} className="shrink-0 text-fg-subtle" />
                {seating ? (
                    <span className="font-brand text-sm font-bold">{seating}</span>
                ) : (
                    <span className="text-xs text-fg-subtle">No seat set</span>
                )}
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setValue(seating || '');
                        setEditing(true);
                    }}
                >
                    <Pencil size={12} />
                    {seating ? 'Edit' : 'Set your seat'}
                </Button>
            </div>
        );
    }

    return (
        <div className={`space-y-1.5 ${className}`}>
            <div className="flex items-center gap-2">
                <input
                    autoFocus
                    value={value}
                    maxLength={SEAT_MAX_LENGTH}
                    placeholder="e.g. B12"
                    aria-label="Your seat"
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
                    className="mds-input h-9 w-28 px-3 text-sm font-bold"
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
                    Save
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
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
            <p className="text-xs text-fg-subtle">{SEAT_HELPER_TEXT}</p>
        </div>
    );
}
