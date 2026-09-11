"use client";

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json() as Promise<T>;
  }

  return response.text() as unknown as T;
}

export async function apiRequest<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const payload = await parseResponse<any>(response);

  if (!response.ok) {
    const message =
      (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : response.statusText) || "Request failed";
    throw new ApiError(message, response.status, payload);
  }

  return payload as T;
}

export const clientApi = {
  getTournaments: (limit: "all" | number = 10) =>
    apiRequest<{ tournaments: any[]; nextCursor: string | null }>(`/api/tournaments?limit=${limit}`),
  getTournament: (id: string) => apiRequest<any>(`/api/tournaments/${id}`),
  getTeams: (tournamentId: string) => apiRequest<any[]>(`/api/tournaments/${tournamentId}/teams`),
  getMatches: (tournamentId: string) => apiRequest<any[]>(`/api/tournaments/${tournamentId}/matches`),
  getScoreboard: (tournamentId: string) => apiRequest<any[]>(`/api/tournaments/${tournamentId}/scoreboard`),
  getProfile: () => apiRequest<any>("/api/user/profile"),
  getQueue: () => apiRequest<{ queue: any[] }>("/api/me/queue"),
  getNotifications: (tournamentId?: string) =>
    apiRequest<any>(`/api/notifications/log${tournamentId ? `?tournamentId=${tournamentId}` : ""}`),
  getAuditLog: (tournamentId?: string) =>
    apiRequest<any>(`/api/audit-log${tournamentId ? `?tournamentId=${tournamentId}` : ""}`),
  createTournament: (payload: unknown) =>
    apiRequest<any>("/api/tournaments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  logoutAdmin: () =>
    apiRequest<{ success: boolean }>("/api/auth/logout", {
      method: "POST",
    }),
  /** Player self-service: update your own Player row (seat / nickname) in one tournament. */
  updateMyPlayer: (payload: { tournamentId: string; seating?: string; nickname?: string }) =>
    apiRequest<{ player: any }>("/api/me/player", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  /** Player self-service: leave your team (only while the roster is unlocked). */
  leaveMyTeam: (tournamentId: string) =>
    apiRequest<{ success: boolean; teamDeleted: boolean; promotedPlayerId: string | null }>(
      `/api/me/player?tournamentId=${encodeURIComponent(tournamentId)}`,
      { method: "DELETE" }
    ),
};
