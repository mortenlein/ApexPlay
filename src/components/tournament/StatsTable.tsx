"use client";

import React from "react";

interface StatsTableProps {
  players: any[];
  onViewPlayer: (player: any) => void;
  getFlagUrl: (countryCode: string | null) => string | null;
}

export function StatsTable({ players, onViewPlayer, getFlagUrl }: StatsTableProps) {
  const sortedPlayers = [...players].sort((a: any, b: any) => {
    const teamCompare = String(a.teamName || "").localeCompare(String(b.teamName || ""));
    if (teamCompare !== 0) {
      return teamCompare;
    }

    return String(a.nickname || a.name || "").localeCompare(String(b.nickname || b.name || ""));
  });

  return (
    <div className="mds-card overflow-hidden p-0 animate-in fade-in duration-500 shadow-xl border-[var(--mds-border)]">
      <header className="px-10 py-8 border-b border-[var(--mds-border)] bg-[var(--mds-input)]/30 backdrop-blur-md">
        <h2 className="text-xl font-black uppercase tracking-tight m-0 leading-none">Player Directory</h2>
        <p className="mds-uppercase-label text-[9px] mt-2 opacity-50 tracking-[0.2em]">Tracked roster and seating details</p>
      </header>

      <div className="overflow-x-auto custom-scrollbar">
        <table className="mds-table">
          <thead>
            <tr className="bg-[var(--mds-page)]/50">
              <th>Player</th>
              <th>Team</th>
              <th className="text-center">Country</th>
              <th className="text-right">Seat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--mds-border)]/30">
            {sortedPlayers.map((player: any) => (
                <tr 
                  key={player.id} 
                  onClick={() => onViewPlayer(player)}
                  className="mds-table-row cursor-pointer transition-colors"
                >
                  <td>
                    <div className="flex items-center gap-3">
                      <span className="font-black text-[13px] uppercase tracking-tight text-[var(--mds-text-primary)] hover:text-[var(--mds-action)] transition-colors">
                        {player.nickname || player.name.split(' ')[0]}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="mds-uppercase-label text-[9px] font-bold opacity-60 tracking-wider truncate max-w-[120px]">
                      {player.teamName}
                    </span>
                  </td>
                  <td className="text-center font-black text-[12px] text-[var(--mds-text-muted)]">
                    {player.countryCode?.toUpperCase() || 'N/A'}
                  </td>
                  <td className="text-right">
                    <span className="text-sm font-black tracking-tight text-[var(--mds-action)]">
                      {player.seating || 'Not assigned'}
                    </span>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
