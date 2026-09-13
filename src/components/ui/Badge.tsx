import React from "react";
import { useTranslations } from "next-intl";
import { matchStatusKey } from "@/lib/match-status";

type Tone = "neutral" | "live" | "ready" | "pending" | "done" | "danger" | "info";

const tones: Record<Tone, string> = {
  // LIVE is a solid fill on a board of tinted chips — the one status allowed to shout.
  // `.mds-badge-live` carries the fill, the halo and the blinking dot (globals.css).
  live: "mds-badge-live",
  neutral: "bg-tint text-fg-muted border border-line",
  ready: "bg-success/15 text-success border border-success/40",
  pending: "bg-warning/15 text-warning border border-warning/40",
  done: "bg-tint-faint text-fg-subtle border border-line",
  danger: "bg-danger/15 text-danger border border-danger/40",
  info: "bg-brand-soft text-brand border border-brand/40",
};

export function Badge({
  tone = "neutral",
  className = "",
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return <span className={`mds-badge ${tones[tone]} ${className}`}>{children}</span>;
}

/**
 * The app's status vocabulary, in one place.
 *
 * Keys cover the canonical match statuses (src/lib/match-status.ts), the legacy spellings still
 * present in old rows, and the derived tournament stages (src/lib/tournament-stage.ts) so a
 * board can badge either without a second component.
 */
const STATUS_TONE: Record<string, Tone> = {
  // Matches
  LIVE: "live",
  IN_PROGRESS: "live",
  READY: "ready",
  WAITING_FOR_PLAYERS: "pending",
  PENDING: "pending",
  COMPLETED: "done",
  FINISHED: "done",
  CANCELLED: "danger",
  FORFEIT: "danger",
  // Tournament stages
  DRAFT: "neutral",
  REGISTRATION: "info",
  COMPLETE: "done",
};

/**
 * Tournament *stages* only. Match statuses deliberately have no table here — they come from
 * `matchStatusLabel` in src/lib/match-status.ts, so the badge and the public board cannot drift
 * into calling the same state two different things.
 */
const STAGE_KEY: Record<string, string> = {
  DRAFT: "draft",
  REGISTRATION: "registration",
  COMPLETE: "complete",
};

/**
 * Last line of defence for "never render a raw enum": anything not in the table above is
 * turned into words — SOME_NEW_STATUS reads "Some new status", never SOME_NEW_STATUS.
 */
function humanize(key: string) {
  const words = key.toLowerCase().split(/[_\s-]+/).filter(Boolean);
  if (words.length === 0) return "Unknown";
  return words[0].charAt(0).toUpperCase() + words[0].slice(1) + (words.length > 1 ? " " + words.slice(1).join(" ") : "");
}

/** Renders a match/tournament status string with a consistent tone + label. */
export function StatusBadge({ status }: { status?: string | null }) {
  const tStatus = useTranslations("status");
  const tStage = useTranslations("stage");
  const key = (status || "PENDING").toUpperCase();
  const tone = STATUS_TONE[key] ?? "neutral";
  // Stage words first (DRAFT/REGISTRATION/COMPLETE are tournament states, not match states),
  // then the canonical match vocabulary, then the never-leak-an-enum fallback.
  const label = STAGE_KEY[key]
    ? tStage(STAGE_KEY[key])
    : key in STATUS_TONE
      ? tStatus(matchStatusKey(key))
      : humanize(key);
  return <Badge tone={tone}>{label}</Badge>;
}

/**
 * The smallest possible status mark, for rows and rails where a badge would be too loud.
 * Always ships with a readable label next to it (`children`) — never colour alone.
 */
export function StatusDot({ status, className = "" }: { status?: string | null; className?: string }) {
  const key = (status || "PENDING").toUpperCase();
  const tone = STATUS_TONE[key] ?? "neutral";
  const variant =
    tone === "live" ? "is-live" : tone === "ready" ? "is-ready" : tone === "pending" ? "is-pending" : "is-done";
  return <span aria-hidden className={`mds-dot ${variant} ${className}`} />;
}
