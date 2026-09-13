"use client";

import React from "react";
import { useTranslations } from "next-intl";

interface StatsTableProps {
  players: any[];
  onViewPlayer: (player: any) => void;
}

export function StatsTable({ players, onViewPlayer }: StatsTableProps) {
  const t = useTranslations("tournament");
  const tCommon = useTranslations("common");
  const sortedPlayers = [...players].sort((a: any, b: any) => {
    const teamCompare = String(a.teamName || "").localeCompare(String(b.teamName || ""));
    if (teamCompare !== 0) {
      return teamCompare;
    }

    return String(a.nickname || a.name || "").localeCompare(String(b.nickname || b.name || ""));
  });

  return (
    <div className="mds-card overflow-hidden p-0 animate-in fade-in duration-500">
      <header className="border-b border-line px-5 py-4">
        <h2 className="m-0 text-lg font-bold tracking-tight">{t("player.directory")}</h2>
        <p className="m-0 mt-0.5 text-xs text-fg-muted">{t("player.directoryHint")}</p>
      </header>

      <div className="custom-scrollbar overflow-x-auto">
        {/* On a phone the team moves under the player's name and country drops out, so the
            seat — the column a LAN spectator came for — stays on screen without scrolling. */}
        <table className="mds-table w-full">
          <thead>
            <tr>
              <th>{tCommon("player")}</th>
              <th className="hidden sm:table-cell">{tCommon("team")}</th>
              <th className="hidden text-center sm:table-cell">{t("player.country")}</th>
              <th className="text-right">{tCommon("seat")}</th>
            </tr>
          </thead>
          <tbody>
            {sortedPlayers.map((player: any) => (
              <tr
                key={player.id}
                onClick={() => onViewPlayer(player)}
                className="mds-table-row cursor-pointer"
              >
                <td>
                  {/* Names get the column, not 40px and an ellipsis. */}
                  <span className="mds-name block text-[13px] text-fg">
                    {player.nickname || player.name}
                  </span>
                  <span className="mds-name mt-0.5 block text-[11px] text-fg-subtle sm:hidden">
                    {player.teamName}
                  </span>
                </td>
                <td className="hidden sm:table-cell">
                  <span className="mds-name text-[13px] text-fg-muted">
                    {player.teamName}
                  </span>
                </td>
                <td className="hidden text-center sm:table-cell">
                  {/* Text, not a flag sprite: the flags are fetched from a third-party CDN and a
                      LAN venue is often offline. */}
                  <span className="mds-numeric text-[12px] text-fg-muted">
                    {player.countryCode?.toUpperCase() || "—"}
                  </span>
                </td>
                <td className="text-right">
                  <span className="mds-numeric text-[13px] font-semibold text-brand">
                    {player.seating || "—"}
                  </span>
                </td>
              </tr>
            ))}
            {sortedPlayers.length === 0 && (
              <tr>
                <td colSpan={4} className="text-sm text-fg-muted">
                  {t("player.none")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
