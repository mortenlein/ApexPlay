"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Users, Search, ArrowRight } from "lucide-react";

interface TeamRegistryProps {
  teams: any[];
  onViewTeam: (team: any) => void;
}

export function TeamRegistry({ teams, onViewTeam }: TeamRegistryProps) {
  const [search, setSearch] = useState("");

  const filteredTeams = teams.filter((t: any) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 pb-10 border-b border-[var(--mds-border)]">
        <div>
          <h2 className="text-3xl font-black uppercase tracking-tight m-0 leading-none">Teams</h2>
          <p className="mt-2 text-[var(--mds-text-subtle)] font-medium text-xs uppercase tracking-widest leading-relaxed">
            Verified participants currently enrolled in the tournament.
          </p>
        </div>
        <div className="relative group w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--mds-text-subtle)] group-focus-within:text-[var(--mds-action)] transition-colors" />
          <input
            type="text"
            placeholder="Search teams..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mds-input h-12 pl-12 w-full font-bold uppercase text-xs tracking-wider"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredTeams.map((team: any) => (
          <div 
            key={team.id} 
            className="mds-card group p-8 hover:border-[var(--mds-action)]/40 transition-all flex flex-col gap-8 relative overflow-hidden"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-6">
                <div className="h-16 w-16 overflow-hidden rounded-lg border border-[var(--mds-border)] bg-[var(--mds-input)] p-3 shadow-mds-inner transition-transform group-hover:scale-110">
                  {team.logoUrl ? (
                    <Image 
                      src={team.logoUrl} 
                      alt="" 
                      width={64}
                      height={64}
                      className="h-full w-full object-contain grayscale group-hover:grayscale-0 transition-all duration-300" 
                    />
                  ) : (
                    <Users size={24} className="text-[var(--mds-text-subtle)] group-hover:text-[var(--mds-action)] transition-colors" />
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-black tracking-tight text-[var(--mds-text-primary)] leading-none uppercase">{team.name}</h3>
                  <p className="mds-uppercase-label text-[10px] mt-2 opacity-50">Seed / {team.seed || "—"}</p>
                </div>
              </div>
              <span className="mds-badge bg-[var(--mds-action-soft)] text-[var(--mds-action)] border border-[var(--mds-action)]/20 font-black">
                {team.players?.length || 0} PLAYERS
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {team.players?.slice(0, 4).map((p: any, idx: number) => (
                <div 
                  key={idx} 
                  className="rounded-md bg-[var(--mds-input)] border border-[var(--mds-border)] p-3 flex items-center justify-between"
                >
                  <span className="text-[11px] font-bold text-[var(--mds-text-muted)] truncate uppercase tracking-tight">
                    {p.nickname || p.name.split(' ')[0]}
                  </span>
                </div>
              ))}
              {team.players?.length > 4 && (
                <div className="rounded-md bg-[var(--mds-input)] border border-[var(--mds-border)] p-3 flex items-center justify-center">
                  <span className="text-[11px] font-black text-[var(--mds-text-subtle)] uppercase tracking-widest">
                    +{team.players.length - 4}
                  </span>
                </div>
              )}
            </div>

            <button 
              onClick={() => onViewTeam(team)}
              className="mds-btn-secondary w-full h-10 text-[10px] font-black uppercase tracking-widest group-hover:bg-[var(--mds-action)] group-hover:text-white transition-all shadow-md group-hover:shadow-[0_0_15px_var(--mds-action-soft)]"
            >
              Details
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
