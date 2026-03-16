/**
 * DatHost API Client
 *
 * Interacts with the DatHost game server management API.
 * Requires: DATHOST_EMAIL, DATHOST_API_KEY, DATHOST_SERVER_ID in .env
 */

const DATHOST_BASE = 'https://dathost.net/api/0.1';

function getAuthHeader(): string {
    const email = process.env.DATHOST_EMAIL;
    const apiKey = process.env.DATHOST_API_KEY;
    if (!email || !apiKey) {
        throw new Error('DatHost credentials not configured (DATHOST_EMAIL, DATHOST_API_KEY)');
    }
    return 'Basic ' + Buffer.from(`${email}:${apiKey}`).toString('base64');
}

function getServerId(): string {
    const serverId = process.env.DATHOST_SERVER_ID;
    if (!serverId) {
        throw new Error('DATHOST_SERVER_ID not configured');
    }
    return serverId;
}

/**
 * Send a console command to the DatHost game server.
 * Uses multipart/form-data with the `line` parameter.
 */
export async function sendConsoleCommand(command: string): Promise<{ success: boolean; error?: string }> {
    const serverId = getServerId();

    try {
        const formData = new FormData();
        formData.append('line', command);

        const res = await fetch(`${DATHOST_BASE}/game-servers/${serverId}/console`, {
            method: 'POST',
            headers: {
                'Authorization': getAuthHeader(),
            },
            body: formData,
        });

        if (!res.ok) {
            const text = await res.text();
            console.error(`[DatHost] Console command failed (${res.status}):`, text);
            return { success: false, error: `DatHost API returned ${res.status}: ${text}` };
        }

        console.log(`[DatHost] Command sent: ${command}`);
        return { success: true };
    } catch (error: any) {
        console.error('[DatHost] Error sending command:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get game server details from DatHost (IP, port, status, etc.)
 */
export async function getServerInfo(): Promise<any> {
    const serverId = getServerId();

    try {
        const res = await fetch(`${DATHOST_BASE}/game-servers/${serverId}`, {
            headers: {
                'Authorization': getAuthHeader(),
            },
        });

        if (!res.ok) {
            throw new Error(`DatHost API returned ${res.status}`);
        }

        return await res.json();
    } catch (error: any) {
        console.error('[DatHost] Error fetching server info:', error);
        throw error;
    }
}
