"use client";

import React from 'react';
import Image from 'next/image';
import { Trophy, Play } from 'lucide-react';
import Link from 'next/link';

interface LiveMatchCardProps {
  match: any;
  tournamentId: string;
}

const LiveMatchCard: React.FC<LiveMatchCardProps> = ({ match, tournamentId }) => {
  return (
    <div className="mds-card group relative p-8 hover:border-[var(--mds-red)]/30 transition-all overflow-hidden flex flex-col items-center">
      <div className="absolute top-0 right-0 px-4 py-1.5 bg-[var(--mds-red)]/10 text-[var(--mds-red)] text-[10px] font-black uppercase tracking-widest border-l border-b border-[var(--mds-red)]/20 animate-pulse rounded-bl-xl z-20">
        Live Match
      </div>

      <div className="flex w-full items-center justify-between gap-6 mb-10 pt-4">
        {/* Home Team */}
        <div className="flex flex-col items-center flex-1 min-w-0">
          <div className="h-16 w-16 mb-4 rounded-mds-comfortable border border-[var(--mds-border)] bg-[var(--mds-input)] p-3 shadow-mds-whisper relative overflow-hidden group-hover:scale-105 transition-transform duration-500">
            {match.homeTeam?.logoUrl ? (
              <Image src={match.homeTeam.logoUrl} alt="" fill className="object-contain grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all" />
            ) : (
              <Trophy size={24} className="text-[var(--mds-text-muted)]" />
            )}
          </div>
          <span className="text-sm font-brand font-bold text-[var(--mds-text-primary)] truncate w-full text-center leading-tight">
            {match.homeTeam?.name || "TBD"}
          </span>
          <span className="mds-uppercase-label text-[9px] mt-1.5 opacity-50">Home</span>
        </div>

        {/* Current Score */}
        <div className="flex flex-col items-center px-4 shrink-0">
          <div className="flex items-center gap-4">
            <span className="font-brand text-4xl font-bold tracking-tighter text-[var(--mds-text-primary)] tabular-nums">
              {match.homeScore}
            </span>
            <span className="text-xl font-bold text-[var(--mds-border)] opacity-50">:</span>
            <span className="font-brand text-4xl font-bold tracking-tighter text-[var(--mds-text-primary)] tabular-nums">
              {match.awayScore}
            </span>
          </div>
          <span className="mds-badge mt-6 bg-[var(--mds-action-soft)] text-[var(--mds-action)] font-bold text-[10px]">
            {`BO${match.bestOf} | Round ${match.round}`}
          </span>
        </div>

        {/* Away Team */}
        <div className="flex flex-col items-center flex-1 min-w-0">
          <div className="h-16 w-16 mb-4 rounded-mds-comfortable border border-[var(--mds-border)] bg-[var(--mds-input)] p-3 shadow-mds-whisper relative overflow-hidden group-hover:scale-105 transition-transform duration-500">
            {match.awayTeam?.logoUrl ? (
              <Image src={match.awayTeam.logoUrl} alt="" fill className="object-contain grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all" />
            ) : (
              <Trophy size={24} className="text-[var(--mds-text-muted)]" />
            )}
          </div>
          <span className="text-sm font-brand font-bold text-[var(--mds-text-primary)] truncate w-full text-center leading-tight">
            {match.awayTeam?.name || "TBD"}
          </span>
          <span className="mds-uppercase-label text-[9px] mt-1.5 opacity-50">Away</span>
        </div>
      </div>

      <Link
        href={`/bracket/${tournamentId}/overlay`}
        target="_blank"
        className="mds-btn-secondary w-full h-11 text-xs font-bold"
      >
        <Play size={14} fill="currentColor" />
        Watch Stream
      </Link>
    </div>
  );
};

export default LiveMatchCard;
