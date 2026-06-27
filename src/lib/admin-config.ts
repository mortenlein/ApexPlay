/**
 * Admin identity allowlist — seeded at deploy time via env (see docker-compose.yml / .env).
 *
 * Admin is an *identity*, not a shared password: a Steam-authenticated user whose
 * steamid64 appears in ADMIN_STEAMIDS is granted admin. Everyone else is a player.
 * This module is edge-safe (no Node APIs) so it can be used from middleware too.
 *
 *   ADMIN_STEAMIDS=76561198000000001,76561198000000002
 */
export function getAdminSteamIds(): string[] {
  return (process.env.ADMIN_STEAMIDS || process.env.ADMIN_STEAMID || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isAdminSteamId(steamId: string | null | undefined): boolean {
  if (!steamId) return false;
  return getAdminSteamIds().includes(String(steamId).trim());
}

export type UserRole = "admin" | "marshal" | "player";

// Marshals are floor staff: they run match flow but aren't full organizers.
// Seeded the same way as admins — a steamid64 allowlist in the deploy env.
export function getMarshalSteamIds(): string[] {
  return (process.env.MARSHAL_STEAMIDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isMarshalSteamId(steamId: string | null | undefined): boolean {
  if (!steamId) return false;
  return getMarshalSteamIds().includes(String(steamId).trim());
}

// "Staff" = anyone who can touch match control: admins (a superset) or marshals.
export function isStaffSteamId(steamId: string | null | undefined): boolean {
  return isAdminSteamId(steamId) || isMarshalSteamId(steamId);
}

export function getRoleForSteamId(steamId: string | null | undefined): UserRole {
  if (isAdminSteamId(steamId)) return "admin";
  if (isMarshalSteamId(steamId)) return "marshal";
  return "player";
}
