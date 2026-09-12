"use client";

import React from "react";

interface StatsTableProps {
  players: any[];
  onViewPlayer: (player: any) => void;
}

export function StatsTable({ players, onViewPlayer }: StatsTableProps) {
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
        <h2 className="m-0 text-lg font-bold tracking-tight">Player Directory</h2>
        <p className="m-0 mt-0.5 text-xs text-fg-muted">
          Who is playing, for which team, and where they sit.
        </p>
      </header>

      <div className="custom-scrollbar overflow-x-auto">
        {/* On a phone the team moves under the player's name and country drops out, so the
            seat — the column a LAN spectator came for — stays on screen without scrolling. */}
        <table className="mds-table w-full">
          <thead>
            <tr>
              <th>Player</th>
              <th className="hidden sm:table-cell">Team</th>
              <th className="hidden text-center sm:table-cell">Country</th>
              <th className="text-right">Seat</th>
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
                  No players on any roster yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
