import React from "react";

type Tone = "neutral" | "live" | "ready" | "pending" | "done" | "danger" | "info";

const tones: Record<Tone, string> = {
  neutral: "bg-white/5 text-fg-muted border border-line",
  live: "bg-danger/15 text-danger border border-danger/30 animate-badge-pulse",
  ready: "bg-success/15 text-success border border-success/30",
  pending: "bg-warning/15 text-warning border border-warning/30",
  done: "bg-white/5 text-fg-subtle border border-line",
  danger: "bg-danger/15 text-danger border border-danger/30",
  info: "bg-brand-soft text-brand border border-brand/30",
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

const STATUS_TONE: Record<string, Tone> = {
  LIVE: "live",
  IN_PROGRESS: "live",
  READY: "ready",
  WAITING_FOR_PLAYERS: "pending",
  PENDING: "pending",
  COMPLETED: "done",
  FINISHED: "done",
};

const STATUS_LABEL: Record<string, string> = {
  WAITING_FOR_PLAYERS: "Waiting",
  IN_PROGRESS: "Live",
};

/** Renders a match/tournament status string with a consistent tone + label. */
export function StatusBadge({ status }: { status?: string | null }) {
  const key = (status || "PENDING").toUpperCase();
  const tone = STATUS_TONE[key] ?? "neutral";
  const label = STATUS_LABEL[key] ?? key.charAt(0) + key.slice(1).toLowerCase();
  return <Badge tone={tone}>{label}</Badge>;
}
