"use client";

import React from "react";
import Image from "next/image";
import { Trophy, Layout } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { byPlayOrder, isLive, matchStatusKey } from "@/lib/match-status";
import { matchRef, matchStatusTone, slotLabel, stageName } from "./match-labels";

interface MatchListProps {
  matches: any[];
  tournamentId: string;
}

function TeamRow({ team, name, score, won, dim }: { team: any; name: string; score: number; won: boolean; dim: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-sm border border-line bg-page">
        {team?.logoUrl ? (
          <Image src={team.logoUrl} alt="" fill className="object-contain p-0.5" />
        ) : (
          <Trophy size={12} className="absolute inset-0 m-auto text-fg-subtle opacity-50" />
        )}
      </div>
      <span
        className={`mds-name min-w-0 flex-1 text-[13px] ${
          dim || !team?.name ? "text-fg-subtle" : "text-fg"
        }`}
      >
        {name}
      </span>
      <span
        className={`mds-numeric text-lg font-bold ${
          won ? "text-brand" : "text-fg-subtle"
        }`}
      >
        {score}
      </span>
    </div>
  );
}

export function MatchList({ matches, tournamentId }: MatchListProps) {
  const t = useTranslations("tournament");
  const tCommon = useTranslations("common");
  const tStatus = useTranslations("status");
  // Grouped by stage in play order — in a double-elimination bracket "round 1" is two different
  // stages (winners and losers), so grouping by the round number mixed them into one heading.
  const groups: { label: string; matches: any[] }[] = [];
  matches
    .slice()
    .sort(byPlayOrder)
    .forEach((match: any) => {
      const label = stageName(match, matches, t);
      const group = groups.find((g) => g.label === label);
      if (group) {
        group.matches.push(match);
      } else {
        groups.push({ label, matches: [match] });
      }
    });

  return (
    <div
      data-testid="public-match-board"
      className="space-y-10 animate-in fade-in duration-500"
    >
      {groups.map(({ label, matches: roundMatches }) => {
        return (
          <section key={label} className="space-y-4">
            <div className="flex items-center gap-4">
              {/* The stage a spectator knows the round by, not "Round 3". */}
              <h2 className="m-0 text-base font-bold tracking-tight">{label}</h2>
              <div className="h-px flex-1 bg-line" />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {roundMatches.map((match: any) => {
                const live = isLive(match.status);
                const homeWon = Boolean(match.winnerId) && match.winnerId === match.homeTeam?.id;
                const awayWon = Boolean(match.winnerId) && match.winnerId === match.awayTeam?.id;

                return (
                  <div
                    key={match.id}
                    data-testid={`public-match-${match.id}`}
                    className={`mds-card flex flex-col gap-3 p-4 ${
                      live ? "border-danger" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      {/* The same short reference other views point at ("Winner of QF3"). */}
                      <span className="mds-uppercase-label text-[10px]">
                        {matchRef(match, matches, t)}
                        {match.bestOf > 1 ? ` · BO${match.bestOf}` : ""}
                      </span>
                      <span
                        data-testid="public-match-status"
                        className={`mds-badge shrink-0 border ${matchStatusTone(match.status)} ${
                          live ? "animate-pulse" : ""
                        }`}
                      >
                        {tStatus(matchStatusKey(match.status))}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <TeamRow
                        team={match.homeTeam}
                        name={slotLabel(match, "HOME", matches, t, tCommon)}
                        score={match.homeScore}
                        won={homeWon}
                        dim={awayWon}
                      />
                      <TeamRow
                        team={match.awayTeam}
                        name={slotLabel(match, "AWAY", matches, t, tCommon)}
                        score={match.awayScore}
                        won={awayWon}
                        dim={homeWon}
                      />
                    </div>

                    {live && (
                      <Link
                        href={`/tournaments/${tournamentId}?tab=bracket`}
                        className="mds-btn-secondary h-9 w-full text-xs"
                      >
                        <Layout size={14} />
                        {t("bracket.open")}
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {matches.length === 0 && (
        <p className="text-sm text-fg-muted">{t("match.none")}</p>
      )}
    </div>
  );
}
