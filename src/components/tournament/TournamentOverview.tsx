"use client";

import React from "react";
import Image from "next/image";
import { Users, Layout, Trophy, ArrowRight, Play } from "lucide-react";
import Link from "next/link";
import LiveMatchCard from "@/components/LiveMatchCard";

interface TournamentOverviewProps {
  tournament: any;
  teams: any[];
  matches: any[];
  liveMatches: any[];
  onViewTeam: (team: any) => void;
  onSetTab: (tab: string) => void;
}

export function TournamentOverview({
  tournament,
  teams,
  matches,
  liveMatches,
  onViewTeam,
  onSetTab,
}: TournamentOverviewProps) {
  return (
    <div className="space-y-12 animate-in fade-in duration-500">
      {/* Featured Live Matches */}
      {liveMatches.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <h2 className="mds-uppercase-label text-[var(--mds-red)]">Live Matches</h2>
            <div className="h-px flex-1 bg-gradient-to-r from-[var(--mds-red)]/20 to-transparent"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {liveMatches.map((match: any) => (
              <LiveMatchCard key={match.id} match={match} tournamentId={tournament.id} />
            ))}
          </div>
        </section>
      )}

      {/* Participants Quick View */}
      <section className="space-y-8">
        <div className="mds-card group relative p-10 bg-[var(--mds-card)]">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-10">
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight">Tournament Overview</h2>
              <p className="mds-uppercase-label text-[9px] mt-2 opacity-50 tracking-[0.2em]">
                Currently tracking {teams.length} participants.
              </p>
            </div>
            <button 
              onClick={() => onSetTab('teams')}
              className="mds-btn-secondary h-11 px-6 text-xs font-bold uppercase tracking-widest"
            >
              View All Teams
              <ArrowRight size={14} />
            </button>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-4">
            {teams.slice(0, 20).map((t: any, idx: number) => (
              <div 
                key={idx} 
                onClick={() => onViewTeam(t)}
                className="aspect-square rounded-md bg-[var(--mds-input)] border border-[var(--mds-border)] p-2 shadow-sm transition-all hover:border-[var(--mds-action)] hover:scale-105 cursor-pointer flex items-center justify-center group/team"
              >
                {t.logoUrl ? (
                  <div className="relative h-full w-full">
                    <Image 
                      src={t.logoUrl} 
                      alt="" 
                      fill 
                      className="object-contain grayscale opacity-60 group-hover/team:grayscale-0 group-hover/team:opacity-100 transition-all" 
                    />
                  </div>
                ) : (
                  <Users size={16} className="text-[var(--mds-text-subtle)]" />
                )}
              </div>
            ))}
            {teams.length > 20 && (
                <div 
                    onClick={() => onSetTab('teams')}
                    className="aspect-square rounded-md bg-[var(--mds-input)] border border-[var(--mds-border)] flex items-center justify-center cursor-pointer hover:bg-[var(--mds-action-soft)] transition-colors"
                >
                    <span className="text-[10px] font-black text-[var(--mds-text-subtle)]">+{teams.length - 20}</span>
                </div>
            )}
          </div>
        </div>
      </section>

      {/* Quick Stats Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="mds-card p-8 flex flex-col items-center text-center gap-4">
              <div className="h-12 w-12 rounded-full bg-[var(--mds-action-soft)] text-[var(--mds-action)] flex items-center justify-center">
                  <Trophy size={24} />
              </div>
              <div>
                  <h3 className="text-xl font-black uppercase tracking-tight">Champion</h3>
                  <p className="text-[10px] mds-uppercase-label opacity-40">Not Yet Determined</p>
              </div>
          </div>
          <div className="mds-card p-8 flex flex-col items-center text-center gap-4">
              <div className="h-12 w-12 rounded-full bg-[var(--mds-green)]/10 text-[var(--mds-green)] flex items-center justify-center">
                  <Layout size={24} />
              </div>
              <div>
                  <h3 className="text-xl font-black uppercase tracking-tight">{matches.length} Matches</h3>
                  <p className="text-[10px] mds-uppercase-label opacity-40">Total Tournament Load</p>
              </div>
          </div>
          <div className="mds-card p-8 flex flex-col items-center text-center gap-4">
              <div className="h-12 w-12 rounded-full bg-[var(--mds-amber)]/10 text-[var(--mds-amber)] flex items-center justify-center">
                  <Users size={24} />
              </div>
              <div>
                  <h3 className="text-xl font-black uppercase tracking-tight">{teams.length} Teams</h3>
                  <p className="text-[10px] mds-uppercase-label opacity-40">Active Participants</p>
              </div>
          </div>
      </section>
    </div>
  );
}
