export type TournamentStage = "DRAFT" | "REGISTRATION" | "LIVE" | "COMPLETE";

export const STAGE_ORDER: TournamentStage[] = ["DRAFT", "REGISTRATION", "LIVE", "COMPLETE"];

const DONE = new Set(["COMPLETED", "FINISHED"]);

/**
 * Derive a tournament's lifecycle stage from its data (no DB field needed):
 *  - DRAFT: fewer than 2 teams, no bracket yet.
 *  - REGISTRATION: enough teams, bracket not generated.
 *  - LIVE: bracket generated, matches still in progress.
 *  - COMPLETE: every match finished.
 */
export function getTournamentStage(teams: any[] = [], matches: any[] = []): TournamentStage {
  if (!matches || matches.length === 0) {
    return (teams?.length || 0) >= 2 ? "REGISTRATION" : "DRAFT";
  }
  const allDone = matches.every((m) => DONE.has(String(m.status || "").toUpperCase()));
  return allDone ? "COMPLETE" : "LIVE";
}

export const STAGE_META: Record<TournamentStage, { label: string; hint: string; action: string }> = {
  DRAFT: { label: "Draft", hint: "Add at least 2 teams to begin.", action: "Add teams" },
  REGISTRATION: { label: "Registration", hint: "Teams are in — seed and generate the bracket.", action: "Generate bracket" },
  LIVE: { label: "Live", hint: "Load matches and update results as they play.", action: "Open control" },
  COMPLETE: { label: "Complete", hint: "All matches finished — champion decided.", action: "Public page" },
};
