"use client";

import React from "react";
import Image from "next/image";
import { Users, Layout, Share2, ArrowRight } from "lucide-react";
import Link from "next/link";

interface TournamentHeroProps {
  tournament: any;
  teamsCount: number;
  matchesCount: number;
  liveMatchesCount: number;
  gameMeta: any;
  onShare: () => void;
}

export function TournamentHero({
  tournament,
  teamsCount,
  matchesCount,
  liveMatchesCount,
  gameMeta,
  onShare,
}: TournamentHeroProps) {
  const canRegister = Boolean(tournament?.steamSignupEnabled) && !Boolean(tournament?.rosterLocked);

  return (
    <header className="relative w-full overflow-hidden shrink-0 border-b border-[var(--mds-border)] bg-[var(--mds-card)]">
      {/* Banner Background */}
      <div className="absolute inset-0 z-0">
        <Image
          src={gameMeta?.bannerUrl || ''}
          fill
          className="object-cover opacity-10 contrast-125 grayscale"
          alt=""
          style={{ objectPosition: gameMeta?.bannerPosition || 'center' }}
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--mds-page)]" />
      </div>

      <div className="relative z-10 px-6 lg:px-12 py-10 lg:py-16 flex flex-col lg:flex-row lg:items-center justify-between gap-8 max-w-[var(--mds-max-content)] mx-auto">
        <div className="flex items-center gap-6 lg:gap-10">
          <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-[var(--mds-border)] bg-[var(--mds-input)] p-4 shadow-lg">
            <Image src={gameMeta?.logoUrl || ''} width={64} height={64} className="object-contain" alt={tournament.game} />
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="mds-badge bg-[var(--mds-action-soft)] text-[var(--mds-action)]">
                {tournament.game} • {tournament.type}
              </span>
              {liveMatchesCount > 0 && (
                <span className="flex items-center gap-2 rounded-full border border-[var(--mds-red)]/20 bg-[var(--mds-red)]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--mds-red)]">
                  <div className="h-1.5 w-1.5 rounded-full bg-[var(--mds-red)] animate-pulse" />
                  Live Now
                </span>
              )}
            </div>
            <h1 className="text-4xl lg:text-6xl font-black tracking-tight leading-none m-0 uppercase">
              {tournament.name}
            </h1>
            <div className="flex flex-wrap items-center gap-8 text-[11px] font-bold mds-uppercase-label mb-0">
              <div className="flex items-center gap-2">
                <Users size={14} className="text-[var(--mds-action)]" />
                <span>{teamsCount} Teams Registered</span>
              </div>
              <div className="flex items-center gap-2">
                <Layout size={14} className="text-[var(--mds-action)]" />
                <span>{matchesCount} Total Matches</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={onShare} className="mds-btn-secondary h-12 px-6">
            <Share2 size={16} />
            Share
          </button>
          {canRegister && (
            <Link href={`/tournaments/${tournament.id}/register`} className="mds-btn-primary h-12 px-8">
              Register Team
              <ArrowRight size={16} />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
