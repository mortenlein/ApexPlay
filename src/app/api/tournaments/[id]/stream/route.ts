import { eventBus } from '@/lib/eventBus';

/**
 * SSE endpoint: GET /api/tournaments/{id}/stream
 * Streams all match updates for a tournament in real-time.
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
    const tournamentId = params.id;

    const stream = new ReadableStream({
        start(controller) {
            const encoder = new TextEncoder();

            // Send initial keepalive
            controller.enqueue(encoder.encode(`: connected to tournament ${tournamentId}\n\n`));

            const listener = (data: any) => {
                try {
                    const payload = `data: ${JSON.stringify(data)}\n\n`;
                    controller.enqueue(encoder.encode(payload));
                } catch (e) {
                    // Client disconnected
                }
            };

            eventBus.on(`tournament:${tournamentId}`, listener);

            // Keepalive every 30s to prevent proxy/browser timeout
            const keepalive = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(`: keepalive\n\n`));
                } catch {
                    clearInterval(keepalive);
                }
            }, 30000);

            // Cleanup on disconnect
            request.signal.addEventListener('abort', () => {
                eventBus.off(`tournament:${tournamentId}`, listener);
                clearInterval(keepalive);
                try { controller.close(); } catch {}
            });
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no', // Disable nginx buffering
        },
    });
}
