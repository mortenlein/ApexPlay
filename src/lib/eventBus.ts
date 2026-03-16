/**
 * Lightweight in-process event bus for broadcasting real-time match updates.
 * Used by the webhook receiver to push events, and by SSE endpoints to stream them.
 */

type Listener = (data: any) => void;

class EventBus {
    private listeners: Map<string, Set<Listener>> = new Map();

    on(channel: string, listener: Listener) {
        if (!this.listeners.has(channel)) {
            this.listeners.set(channel, new Set());
        }
        this.listeners.get(channel)!.add(listener);
    }

    off(channel: string, listener: Listener) {
        this.listeners.get(channel)?.delete(listener);
        if (this.listeners.get(channel)?.size === 0) {
            this.listeners.delete(channel);
        }
    }

    emit(channel: string, data: any) {
        this.listeners.get(channel)?.forEach((listener) => {
            try {
                listener(data);
            } catch (e) {
                console.error(`[EventBus] Error in listener for ${channel}:`, e);
            }
        });
    }
}

// Singleton — survives hot reloads in dev via globalThis
declare global {
    var __eventBus: EventBus | undefined;
}

export const eventBus = globalThis.__eventBus ?? new EventBus();

if (process.env.NODE_ENV !== 'production') {
    globalThis.__eventBus = eventBus;
}
