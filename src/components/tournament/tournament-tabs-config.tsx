"use client";

import { Globe, Layout, Users, UserRound, Calendar } from "lucide-react";

export interface TournamentTabItem {
  id: string;
  label: string;
  icon: any;
}

export function getTournamentTabItems(tournamentCategory: string): TournamentTabItem[] {
  return [
    { id: "overview", icon: Globe, label: "Overview" },
    {
      id: tournamentCategory === "BATTLE_ROYALE" ? "leaderboard" : "bracket",
      icon: Layout,
      label: tournamentCategory === "BATTLE_ROYALE" ? "Leaderboard" : "Bracket",
    },
    { id: "teams", icon: Users, label: "Teams" },
    { id: "players", icon: UserRound, label: "Players" },
    { id: "matches", icon: Calendar, label: "Matches" },
  ];
}
