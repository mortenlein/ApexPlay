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
  updateTeam: (teamId: string, payload: unknown) =>
    apiRequest<any>(`/api/teams/${teamId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  // `force` pulls the team out of any match it is placed in; required while the roster is locked.
  deleteTeam: (teamId: string, options?: { force?: boolean }) =>
    apiRequest<{ success: boolean; matchesAffected: number }>(
      `/api/teams/${teamId}${options?.force ? "?force=1" : ""}`,
      { method: "DELETE" }
    ),
  addTeamPlayer: (teamId: string, payload: unknown) =>
    apiRequest<any>(`/api/teams/${teamId}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  updatePlayer: (playerId: string, payload: unknown) =>
    apiRequest<any>(`/api/players/${playerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deletePlayer: (playerId: string) =>
    apiRequest<{ success: boolean }>(`/api/players/${playerId}`, { method: "DELETE" }),
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
};
