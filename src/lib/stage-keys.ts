import type { TournamentStage } from "@/lib/tournament-stage";

/**
 * Tournament stage → `stage.*` message key.
 *
 * `STAGE_META.label` in tournament-stage.ts is the English word for a non-React caller (logs,
 * exports). Anything rendered goes through this map + `t('stage.*')`, the same way a match
 * status goes through `matchStatusKey()` + `t('status.*')` — one vocabulary per state, never two.
 */
export const STAGE_KEY: Record<TournamentStage, string> = {
  DRAFT: "draft",
  REGISTRATION: "registration",
  LIVE: "live",
  COMPLETE: "complete",
};
