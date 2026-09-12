"use client";

import React from "react";
import Image from "next/image";
import { Users, ArrowRight, Trophy } from "lucide-react";
import LiveMatchCard from "@/components/LiveMatchCard";
import { isDone, isLive, byPlayOrder } from "@/lib/match-status";
import { currentStageProgress, slotLabel, stageName } from "./match-labels";

interface TournamentOverviewProps {
  tournament: any;
  teams: any[];
  matches: any[];
  liveMatches: any[];
  onViewTeam: (team: any) => void;
  onSetTab: (tab: string) => void;
}

export function TournamentOverview({
  tournament,
  teams,
  matches,
  liveMatches,
  onViewTeam,
  onSetTab,
}: TournamentOverviewProps) {
  const progress = currentStageProgress(matches);
  const upNext = matches
    .filter((m: any) => !isDone(m.status) && !isLive(m.status))
    .sort(byPlayOrder)
    .slice(0, 4);

  // A champion is only real once the deciding match is played — and the 3rd place match is
  // never the deciding one, however late it is played.
  const decider = matches
    .filter((m: any) => (m.bracketType || "WINNERS").toUpperCase() !== "THIRD_PLACE")
    .sort(byPlayOrder)
    .slice(-1)[0];
  const champion =
    decider && isDone(decider.status) && decider.winnerId
      ? [decider.homeTeam, decider.awayTeam].find((t: any) => t?.id === decider.winnerId) || null
      : null;

  const stageLine = champion
    ? `Complete — ${champion.name} won the ${stageName(decider, matches)}`
    : progress
      ? `${progress.label} · ${progress.played} of ${progress.total} played`
      : matches.length === 0
        ? "The bracket has not been generated yet."
        : "Every match has been played.";

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      {/* What is happening right now — the reason a spectator opened the page. */}
      {liveMatches.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="h-1.5 w-1.5 rounded-full bg-danger animate-pulse" />
            <h2 className="mds-uppercase-label m-0 text-danger">Live now</h2>
            <div className="h-px flex-1 bg-gradient-to-r from-danger to-transparent" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {liveMatches.map((match: any) => (
              <LiveMatchCard
                key={match.id}
                match={match}
                tournamentId={tournament.id}
                stageName={stageName(match, matches)}
              />
            ))}
          </div>
        </section>
      )}

      {upNext.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="mds-uppercase-label m-0">Up next</h2>
            <div className="h-px flex-1 bg-line" />
            <button
              onClick={() => onSetTab("matches")}
              className="mds-uppercase-label text-[10px] text-brand hover:underline"
            >
              All matches
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {upNext.map((match: any) => (
              <div
                key={match.id}
                className="rounded border border-line bg-card p-4"
              >
                <span className="mds-uppercase-label text-[10px]">{stageName(match, matches)}</span>
                <div className="mt-1.5 space-y-0.5 text-sm">
                  <p className="mds-name m-0">{slotLabel(match, "HOME", matches)}</p>
                  <p className="mds-name m-0 text-fg-muted">{slotLabel(match, "AWAY", matches)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mds-card p-6 lg:p-8">
        <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="min-w-0">
            <h2 className="m-0 text-xl font-bold tracking-tight">Tournament Overview</h2>
            {/* Where the bracket actually is, instead of a decorative "29%" progress bar. */}
            <p className="m-0 mt-1 text-sm text-fg-muted">{stageLine}</p>
          </div>
          <button
            onClick={() => onSetTab("teams")}
            className="mds-btn-secondary h-9 shrink-0 px-4 text-xs"
          >
            View all teams
            <ArrowRight size={14} />
          </button>
        </div>

        {champion ? (
          <div className="mb-6 flex items-center gap-3 rounded border border-brand bg-brand-soft px-4 py-3">
            <Trophy size={18} className="shrink-0 text-brand" />
            <div className="min-w-0">
              <span className="mds-uppercase-label text-[10px]">Champion</span>
              <p className="mds-name m-0 text-base text-fg">{champion.name}</p>
            </div>
          </div>
        ) : null}

        {/* Teams as named chips: a grid of anonymous logo squares told a spectator nothing. */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {teams.map((team: any) => (
            <button
              key={team.id}
              type="button"
              onClick={() => onViewTeam(team)}
              className="flex items-center gap-3 rounded border border-line bg-field px-3 py-2 text-left transition-colors hover:border-brand"
            >
              <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-sm bg-page">
                {team.logoUrl ? (
                  <Image src={team.logoUrl} alt="" fill className="object-contain p-0.5" />
                ) : (
                  <Users size={12} className="absolute inset-0 m-auto text-fg-subtle" />
                )}
              </div>
              <span className="mds-name min-w-0 flex-1 text-[13px]">{team.name}</span>
              {team.seed ? (
                <span className="mds-numeric shrink-0 text-[11px] text-fg-subtle">
                  #{team.seed}
                </span>
              ) : null}
            </button>
          ))}
          {teams.length === 0 ? (
            <p className="text-sm text-fg-muted">No teams have registered yet.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
