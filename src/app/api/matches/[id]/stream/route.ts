import { eventBus } from '@/lib/eventBus';

/**
 * SSE endpoint: GET /api/matches/{id}/stream
 * Streams updates for a single match in real-time.
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
    const matchId = params.id;

    const stream = new ReadableStream({
        start(controller) {
            const encoder = new TextEncoder();

            controller.enqueue(encoder.encode(`: connected to match ${matchId}\n\n`));

            const listener = (data: any) => {
                try {
                    const payload = `data: ${JSON.stringify(data)}\n\n`;
                    controller.enqueue(encoder.encode(payload));
                } catch (e) {
                    // Client disconnected
                }
            };

            eventBus.on(`match:${matchId}`, listener);

            const keepalive = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(`: keepalive\n\n`));
                } catch {
                    clearInterval(keepalive);
                }
            }, 30000);

            request.signal.addEventListener('abort', () => {
                eventBus.off(`match:${matchId}`, listener);
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
            'X-Accel-Buffering': 'no',
        },
    });
}
