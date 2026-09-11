'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * One frame off the tournament channel. Match mutations carry { matchId, match }; other events
 * forwarded on the same channel (e.g. { type: 'player:checkin', playerId, checkedInAt }) carry a
 * `type` instead, so consumers must narrow before using a field.
 */
export interface MatchStreamEvent {
    matchId?: string;
    tournamentId?: string;
    match?: any;
    type?: string;
    [key: string]: any;
}

export type StreamStatus = 'idle' | 'connecting' | 'open' | 'reconnecting';

export interface MatchStreamState {
    /** Connection state, so a live board can show whether it is really live. */
    status: StreamStatus;
    /** Wall-clock time of the last frame (data or keepalive comment is NOT counted — data only). */
    lastEventAt: number | null;
}

interface MatchStreamOptions {
    /**
     * Fired after a connection is (re)established following a drop. The stream does not replay
     * missed frames, so consumers should refetch here to heal whatever happened while offline.
     */
    onReconnect?: () => void;
}

const MAX_RETRY_DELAY_MS = 30000;

/**
 * Subscribe to the tournament SSE channel (`/api/tournaments/[id]/stream`).
 *
 * Reconnects with exponential backoff (1s → 30s). Every EventSource and every pending retry
 * timer is tracked in refs and torn down on unmount / tournament change, so navigating away
 * never leaves a zombie stream behind (the previous version only closed the first socket).
 */
export function useMatchStream(
    tournamentId: string | null,
    onEvent: (data: MatchStreamEvent) => void,
    options: MatchStreamOptions = {}
): MatchStreamState {
    const callbackRef = useRef(onEvent);
    callbackRef.current = onEvent;
    const onReconnectRef = useRef(options.onReconnect);
    onReconnectRef.current = options.onReconnect;

    const [state, setState] = useState<MatchStreamState>({ status: 'idle', lastEventAt: null });

    useEffect(() => {
        if (!tournamentId) {
            setState({ status: 'idle', lastEventAt: null });
            return;
        }

        let disposed = false;
        let source: EventSource | null = null;
        let retryTimer: ReturnType<typeof setTimeout> | null = null;
        let retryCount = 0;
        let hadDrop = false;

        const connect = () => {
            if (disposed) return;
            setState((prev) => ({ ...prev, status: retryCount === 0 && !hadDrop ? 'connecting' : 'reconnecting' }));
            source = new EventSource(`/api/tournaments/${tournamentId}/stream`);

            source.onopen = () => {
                if (disposed) return;
                retryCount = 0;
                setState((prev) => ({ ...prev, status: 'open' }));
                if (hadDrop) {
                    hadDrop = false;
                    onReconnectRef.current?.();
                }
            };

            source.onmessage = (event) => {
                if (disposed) return;
                try {
                    const data = JSON.parse(event.data);
                    setState((prev) => ({ ...prev, lastEventAt: Date.now() }));
                    callbackRef.current(data);
                } catch (e) {
                    console.error('[useMatchStream] Parse error:', e);
                }
            };

            source.onerror = () => {
                if (disposed) return;
                source?.close();
                source = null;
                hadDrop = true;
                const delay = Math.min(Math.pow(2, retryCount) * 1000, MAX_RETRY_DELAY_MS);
                retryCount += 1;
                setState((prev) => ({ ...prev, status: 'reconnecting' }));
                retryTimer = setTimeout(connect, delay);
            };
        };

        connect();

        return () => {
            disposed = true;
            if (retryTimer) clearTimeout(retryTimer);
            source?.close();
            source = null;
        };
    }, [tournamentId]);

    return state;
}
