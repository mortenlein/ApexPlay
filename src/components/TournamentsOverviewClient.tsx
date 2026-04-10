"use client";

import React from "react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Users, ArrowRight, Loader2, Search, Gamepad2, Calendar, Globe, Zap, Shield, Layout } from "lucide-react";
import Link from "next/link";
import { getGameMetadata } from "@/lib/games";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { ContextBar } from "@/components/ContextBar";
import { clientApi } from "@/lib/client-api";

export default function TournamentsOverviewClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchQuery = searchParams.get("search") || "";

  const { data, isLoading } = useQuery({
    queryKey: ['tournaments'],
    queryFn: async () => clientApi.getTournaments('all'),
    staleTime: 60 * 1000,
  });

  const tournaments = data?.tournaments || [];

  const handleSearch = (term: string) => {
    const params = new URLSearchParams(searchParams);
    if (term) { params.set("search", term); } else { params.delete("search"); }
    router.replace(`${pathname}?${params.toString()}`);
  };

  const filteredTournaments = tournaments.filter((t: any) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.game.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[var(--mds-page)] overflow-x-hidden flex flex-col">
      <ContextBar
        mode="public"
        contextLabel="Tournament Directory"
        phase="Discovery"
        breadcrumbs={["tournaments"]}
      />
      <div className="flex-1 overflow-x-hidden">
        {/* HERO */}
      <section className="relative pt-32 pb-24 px-6 md:px-10 bg-[var(--mds-page-dark)] overflow-hidden">
         <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,var(--mds-action)_0%,transparent_70%)] blur-3xl transform -translate-y-1/2" />
         </div>
         
         <div className="max-w-[1400px] mx-auto relative z-10">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-12">
               <div className="max-w-2xl">
                  <div className="flex items-center gap-3 mb-6">
                     <span className="h-px w-8 bg-[var(--mds-action)]" />
                     <span className="mds-uppercase-label text-[var(--mds-action)]">Tournament Directory</span>
                  </div>
                  <h1 className="font-brand text-5xl md:text-7xl font-bold tracking-tight text-white leading-[1.05]">
                     Discover <br/> Active <span className="text-[var(--mds-action)]">Tournaments</span>
                  </h1>
                  <p className="mt-8 text-lg font-medium text-white/50 max-w-lg leading-relaxed">
                     Browse live and upcoming tournaments, track brackets in real time, and jump into the events you care about.
                  </p>
               </div>

               <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                  <div className="relative flex-1 lg:w-80 group">
                     <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-[var(--mds-action)] transition-colors" />
                     <input
                        type="text"
                        placeholder="Filter tournaments..."
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-mds-comfortable h-14 pl-12 pr-6 text-white font-medium placeholder:text-white/20 focus:outline-none focus:border-[var(--mds-action)]/50 focus:bg-white/10 transition-all"
                     />
                  </div>
               </div>
            </div>
         </div>
      </section>

      {/* REGISTRY CONTENT */}
      <main className="py-20 px-6 md:px-10 max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between mb-12 border-b border-[var(--mds-border)] pb-8">
            <div className="flex items-center gap-6">
                <h2 className="mds-uppercase-label">Active Tournaments</h2>
                <span className="mds-badge bg-[var(--mds-input)] font-bold text-[var(--mds-text-muted)]">
                   {isLoading ? 'Loading...' : `${filteredTournaments.length} listed`}
                </span>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-bold text-[var(--mds-text-muted)] uppercase tracking-widest">
                <Globe size={14} className="text-[var(--mds-action)]" />
                Public tournament directory
            </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-6">
            <Loader2 className="w-10 h-10 animate-spin text-[var(--mds-action)]" />
            <p className="mds-uppercase-label opacity-40">Loading tournaments...</p>
          </div>
        ) : filteredTournaments.length === 0 ? (
          <div className="mds-card p-32 text-center bg-[var(--mds-input)]/20 border-dashed border-2 border-[var(--mds-border)] shadow-none">
            <div className="h-16 w-16 mx-auto mb-8 bg-[var(--mds-border)]/20 flex items-center justify-center rounded-xl text-[var(--mds-text-muted)]">
                <Gamepad2 size={32} />
            </div>
            <h3 className="font-brand text-2xl font-bold mb-3 text-[var(--mds-text-primary)]">
              {searchQuery ? "No Results Found" : "No Active Tournaments"}
            </h3>
            <p className="text-[var(--mds-text-muted)] font-medium max-w-xs mx-auto leading-relaxed">
              {searchQuery ? "No tournament matched your search." : "No tournaments are available yet."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredTournaments.map((t: any, index: number) => {
              const gameMeta = getGameMetadata(t.game);
              return (
                <Link
                  key={t.id}
                  href={`/tournaments/${t.id}`}
                  className="group mds-card p-0 overflow-hidden flex flex-col h-[480px] hover:border-[var(--mds-action)]/40 hover:-translate-y-1 transition-all duration-500"
                >
                  {/* Banner */}
                  <div className="relative h-56 w-full overflow-hidden shrink-0 border-b border-[var(--mds-border)]">
                    <Image
                      src={gameMeta?.bannerUrl || "/default-banner.jpg"}
                      alt={t.game}
                      fill
                      className="object-cover grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-105 transition-all duration-1000"
                      style={{ objectPosition: gameMeta?.bannerPosition || 'center' }}
                      priority={index < 3}
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[var(--mds-page)] via-transparent to-transparent opacity-60" />
                    
                    <div className="absolute top-6 left-6 flex items-center gap-3">
                      <div className="h-10 w-10 rounded-mds-comfortable bg-[var(--mds-page)]/90 backdrop-blur-md flex items-center justify-center p-2 border border-[var(--mds-border)] shadow-mds-whisper group-hover:scale-110 transition-transform">
                        <Image src={gameMeta?.logoUrl || ''} width={24} height={24} className="object-contain" alt="" />
                      </div>
                      <span className="mds-badge bg-black/40 backdrop-blur-md text-white border-white/10 font-bold">
                        {gameMeta?.name}
                      </span>
                    </div>
                  </div>

                  <div className="p-8 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-brand text-2xl font-bold text-[var(--mds-text-primary)] leading-tight group-hover:text-[var(--mds-action)] transition-colors line-clamp-2">
                        {t.name}
                      </h3>
                      <div className="mt-6 flex flex-wrap gap-4">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-[var(--mds-text-muted)] uppercase tracking-widest">
                           <Users size={12} className="text-[var(--mds-action)]" />
                           {t.teamSize}v{t.teamSize} roster
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-[var(--mds-text-muted)] uppercase tracking-widest">
                           <Calendar size={12} className="text-[var(--mds-action)]" />
                           Details available
                        </div>
                      </div>
                    </div>

                    <div className="pt-8 mt-auto border-t border-[var(--mds-border)]/50 flex items-center justify-between">
                        <span className="font-brand text-sm font-bold text-[var(--mds-text-primary)] uppercase tracking-tight">Open Tournament</span>
                        <div className="h-8 w-8 rounded-full border border-[var(--mds-border)] flex items-center justify-center group-hover:bg-[var(--mds-action)] group-hover:border-[var(--mds-action)] group-hover:text-white transition-all">
                           <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                        </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="border-t border-[var(--mds-border)] py-20 bg-[var(--mds-input)]/10">
        <div className="max-w-[1400px] mx-auto px-6 md:px-10 flex flex-col items-center">
            <div className="h-14 w-14 rounded-mds-comfortable bg-[var(--mds-action)]/10 flex items-center justify-center border border-[var(--mds-action)]/20 mb-8 shadow-mds-whisper">
                <Shield size={24} className="text-[var(--mds-action)]" />
            </div>
            <h4 className="font-brand text-2xl font-bold text-[var(--mds-text-primary)] text-center">
                Tournament management <span className="text-[var(--mds-action)]">workspace</span>
            </h4>
            <p className="mt-4 text-[var(--mds-text-muted)] font-medium text-center max-w-sm leading-relaxed">
                Brackets, teams, streams, and match updates in one place.
            </p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-12 mt-16 w-full max-w-3xl border-t border-[var(--mds-border)] pt-16">
                <div>
                   <h5 className="mds-uppercase-label text-[10px] mb-6">Planning</h5>
                   <ul className="space-y-4 text-sm font-medium text-[var(--mds-text-muted)]">
                      <li className="hover:text-[var(--mds-action)] cursor-pointer transition-colors">Event setup</li>
                      <li className="hover:text-[var(--mds-action)] cursor-pointer transition-colors">Bracket flow</li>
                      <li className="hover:text-[var(--mds-action)] cursor-pointer transition-colors">Sign-up options</li>
                   </ul>
                </div>
                <div>
                   <h5 className="mds-uppercase-label text-[10px] mb-6">Live Ops</h5>
                   <ul className="space-y-4 text-sm font-medium text-[var(--mds-text-muted)]">
                      <li className="hover:text-[var(--mds-action)] cursor-pointer transition-colors">Match updates</li>
                      <li className="hover:text-[var(--mds-action)] cursor-pointer transition-colors">Overlay output</li>
                      <li className="hover:text-[var(--mds-action)] cursor-pointer transition-colors">Marshal board</li>
                   </ul>
                </div>
                <div>
                   <h5 className="mds-uppercase-label text-[10px] mb-6">Resources</h5>
                   <ul className="space-y-4 text-sm font-medium text-[var(--mds-text-muted)]">
                      <li className="hover:text-[var(--mds-action)] cursor-pointer transition-colors">Tournament Rules & FAQ</li>
                      <li className="hover:text-[var(--mds-action)] cursor-pointer transition-colors">Player Guide</li>
                      <li className="hover:text-[var(--mds-action)] cursor-pointer transition-colors">Service Status</li>
                   </ul>
                </div>
                <div>
                   <h5 className="mds-uppercase-label text-[10px] mb-6">Connect</h5>
                   <ul className="space-y-4 text-sm font-medium text-[var(--mds-text-muted)]">
                      <li className="hover:text-[var(--mds-action)] cursor-pointer transition-colors">Admin Support</li>
                      <li className="hover:text-[var(--mds-action)] cursor-pointer transition-colors">Feedback</li>
                      <li className="hover:text-[var(--mds-action)] cursor-pointer transition-colors">Contact Staff</li>
                   </ul>
                </div>
            </div>
            
            <div className="mt-20 flex flex-col items-center gap-4">
                <div className="h-px w-24 bg-[var(--mds-border)]" />
                <p className="mds-uppercase-label text-[9px] opacity-40">ApexPlay tournament directory</p>
            </div>
        </div>
      </footer>
      </div>
    </div>
  );
}
