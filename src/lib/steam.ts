/**
 * Steam ID Resolution Utility
 *
 * Converts Steam Profile URLs or vanity names into SteamID64.
 * Accepts:
 *   - Raw SteamID64: "76561198012345678"
 *   - Full profile URL: "https://steamcommunity.com/profiles/76561198012345678"
 *   - Vanity URL: "https://steamcommunity.com/id/morten"
 *   - Just the vanity name: "morten"
 */

const STEAMID64_REGEX = /^[0-9]{17}$/;
const PROFILE_URL_REGEX = /steamcommunity\.com\/profiles\/([0-9]{17})/;
const VANITY_URL_REGEX = /steamcommunity\.com\/id\/([^\/\?\#]+)/;

export async function resolveSteamId(input: string): Promise<string | null> {
    if (!input || !input.trim()) return null;

    const trimmed = input.trim();

    // Case 1: Already a SteamID64
    if (STEAMID64_REGEX.test(trimmed)) {
        return trimmed;
    }

    // Case 2: Full profile URL with SteamID64
    const profileMatch = trimmed.match(PROFILE_URL_REGEX);
    if (profileMatch) {
        return profileMatch[1];
    }

    // Case 3: Vanity URL — extract the vanity name
    const vanityMatch = trimmed.match(VANITY_URL_REGEX);
    const vanityName = vanityMatch ? vanityMatch[1] : trimmed;

    // Case 4: Resolve vanity name via Steam API
    const apiKey = process.env.STEAM_API_KEY;
    if (!apiKey) {
        console.warn('[Steam] STEAM_API_KEY not set, cannot resolve vanity URL');
        return null;
    }

    try {
        const res = await fetch(
            `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/?key=${apiKey}&vanityurl=${encodeURIComponent(vanityName)}`
        );
        const data = await res.json();

        if (data.response?.success === 1) {
            return data.response.steamid;
        }

        console.warn(`[Steam] Could not resolve vanity "${vanityName}":`, data.response);
        return null;
    } catch (error) {
        console.error('[Steam] API error:', error);
        return null;
    }
}
