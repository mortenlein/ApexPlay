"use client";

import { Globe, Layout, Users, UserRound, Calendar } from "lucide-react";

export interface TournamentTabItem {
  id: string;
  /** Key in the `tournament` namespace — the label is translated where it is rendered. */
  labelKey: string;
  icon: any;
}

export function getTournamentTabItems(tournamentCategory: string): TournamentTabItem[] {
  const battleRoyale = tournamentCategory === "BATTLE_ROYALE";
  return [
    { id: "overview", icon: Globe, labelKey: "tabs.overview" },
    {
      id: battleRoyale ? "leaderboard" : "bracket",
      icon: Layout,
      labelKey: battleRoyale ? "tabs.leaderboard" : "tabs.bracket",
    },
    { id: "teams", icon: Users, labelKey: "tabs.teams" },
    { id: "players", icon: UserRound, labelKey: "tabs.players" },
    { id: "matches", icon: Calendar, labelKey: "tabs.matches" },
  ];
}
