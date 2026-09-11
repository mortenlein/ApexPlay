'use client';

import { useEffect, useRef, useCallback } from 'react';

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

/**
 * React hook for subscribing to real-time match updates via SSE.
 * 
 * @param tournamentId - The tournament ID to subscribe to
 * @param onMatchUpdate - Callback fired with updated match data
 * 
 * Usage:
 *   useMatchStream(tournamentId, (data) => {
 *       // data.matchId, data.match (full match object with teams/players)
 *       setMatches(prev => prev.map(m => m.id === data.matchId ? data.match : m));
 *   });
 */
export function useMatchStream(
    tournamentId: string | null,
    onMatchUpdate: (data: MatchStreamEvent) => void
) {
    const callbackRef = useRef(onMatchUpdate);
    callbackRef.current = onMatchUpdate;

    const retryCountRef = useRef(0);
    const maxRetryDelay = 30000; // 30 seconds

    const reconnect = useCallback(() => {
        if (!tournamentId) return;

        const eventSource = new EventSource(`/api/tournaments/${tournamentId}/stream`);

        eventSource.onopen = () => {
            console.log('[useMatchStream] Connection established');
            retryCountRef.current = 0; // Reset on success
        };

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                callbackRef.current(data);
            } catch (e) {
                console.error('[useMatchStream] Parse error:', e);
            }
        };

        eventSource.onerror = () => {
            eventSource.close();
            
            // Exponential backoff: 1s, 2s, 4s, 8s... up to 30s
            const delay = Math.min(Math.pow(2, retryCountRef.current) * 1000, maxRetryDelay);
            console.log(`[useMatchStream] Connection error. Retrying in ${delay}ms...`);
            
            setTimeout(() => {
                retryCountRef.current++;
                reconnect();
            }, delay);
        };

        return eventSource;
    }, [tournamentId]);

    useEffect(() => {
        if (!tournamentId) return;

        const eventSource = reconnect();

        return () => {
            eventSource?.close();
        };
    }, [tournamentId, reconnect]);
}
