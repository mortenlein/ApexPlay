"use client";

import React from "react";
import Image from "next/image";
import { Trophy, Play } from "lucide-react";
import Link from "next/link";

interface MatchListProps {
  matches: any[];
  tournamentId: string;
}

export function MatchList({ matches, tournamentId }: MatchListProps) {
  const rounds = [...new Set(matches.map((m: any) => m.round))].sort((a: any, b: any) => a - b);

  return (
    <div className="space-y-16 pb-20 animate-in fade-in duration-500">
      {rounds.map((round: any) => (
        <div key={round} className="space-y-8">
          <div className="flex items-center gap-6">
            <h2 className="mds-uppercase-label text-[var(--mds-action)] font-black text-[14px]">Round {round}</h2>
            <div className="h-px flex-1 bg-gradient-to-r from-[var(--mds-border)] to-transparent" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {matches
              .filter((m: any) => m.round === round)
              .sort((a: any, b: any) => a.matchOrder - b.matchOrder)
              .map((match: any, idx: number) => (
                <div key={match.id} className="mds-card group p-6 hover:border-[var(--mds-action)]/40 transition-all flex flex-col gap-6 relative overflow-hidden bg-[var(--mds-card)]">
                  <div className="absolute top-0 right-0 px-3 py-1 bg-[var(--mds-input)] text-[9px] font-bold text-[var(--mds-text-subtle)] border-l border-b border-[var(--mds-border)] uppercase tracking-wider">
                    Match #{idx + 1}
                  </div>
                  
                  <div className="flex items-center justify-between gap-4 mt-2">
                    <div className="flex-1 flex flex-col items-center gap-3">
                      <div className="h-12 w-12 rounded-lg border border-[var(--mds-border)] bg-[var(--mds-page)] p-2 shadow-sm transition-transform group-hover:scale-110">
                        {match.homeTeam?.logoUrl ? (
                          <Image src={match.homeTeam.logoUrl} alt="" width={32} height={32} className="h-full w-full object-contain grayscale group-hover:grayscale-0" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center opacity-20"><Trophy size={16} /></div>
                        )}
                      </div>
                      <span className="text-[12px] font-bold text-[var(--mds-text-primary)] truncate max-w-[100px] text-center uppercase tracking-tight">{match.homeTeam?.name || "TBD"}</span>
                    </div>

                    <div className="flex flex-col items-center gap-1.5 min-w-[120px]">
                      <span className={`text-3xl font-black tracking-tighter tabular-nums ${match.status === 'LIVE' ? 'text-[var(--mds-red)] text-shadow-[0_0_10px_var(--mds-red)]' : 'text-[var(--mds-text-primary)]'}`}>
                        {match.homeScore} : {match.awayScore}
                      </span>
                      <div className={`px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-2 ${
                        match.status === 'LIVE' ? 'bg-[var(--mds-red)]/10 border-[var(--mds-red)]/40 text-[var(--mds-red)] animate-pulse' : 
                        match.status === 'COMPLETED' ? 'bg-[var(--mds-green)]/10 border-[var(--mds-green)]/40 text-[var(--mds-green)]' : 
                        'bg-[var(--mds-input)] border-[var(--mds-border)] text-[var(--mds-text-muted)]'
                      }`}>
                        {match.status === 'LIVE' && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                        {match.status === 'COMPLETED' ? 'FINAL' : match.status}
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col items-center gap-3">
                      <div className="h-12 w-12 rounded-lg border border-[var(--mds-border)] bg-[var(--mds-page)] p-2 shadow-sm transition-transform group-hover:scale-110">
                        {match.awayTeam?.logoUrl ? (
                          <Image src={match.awayTeam.logoUrl} alt="" width={32} height={32} className="h-full w-full object-contain grayscale group-hover:grayscale-0" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center opacity-20"><Trophy size={16} /></div>
                        )}
                      </div>
                      <span className="text-[12px] font-bold text-[var(--mds-text-primary)] truncate max-w-[100px] text-center uppercase tracking-tight">{match.awayTeam?.name || "TBD"}</span>
                    </div>
                  </div>

                  {match.status === 'LIVE' && (
                    <div className="flex flex-col gap-2">
                      <Link 
                        href={`/bracket/${tournamentId}/overlay`}
                        target="_blank"
                        className="mds-btn-primary h-10 w-full text-[11px] gap-2 font-bold uppercase tracking-widest"
                      >
                        <Play size={14} fill="currentColor" /> Watch Stream
                      </Link>
                      
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
