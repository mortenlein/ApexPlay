"use client";

import React from "react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Users, Calendar, ArrowRight, Loader2, Search, Gamepad2 } from "lucide-react";
import Link from "next/link";
import { getGameMetadata } from "@/lib/games";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

export default function TournamentsOverviewClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchQuery = searchParams.get("search") || "";

  const { data, isLoading } = useQuery({
    queryKey: ['tournaments'],
    queryFn: async () => {
      const res = await fetch("/api/tournaments");
      if (!res.ok) throw new Error('Failed to fetch tournaments');
      return res.json();
    },
    staleTime: 60 * 1000,
  });

  const tournaments = data?.tournaments || [];

  const handleSearch = (term: string) => {
    const params = new URLSearchParams(searchParams);
    if (term) {
      params.set("search", term);
    } else {
      params.delete("search");
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  const filteredTournaments = tournaments.filter((t: any) => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.game.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0d0f12] text-white selection:bg-blue-500/30">
      {/* HEADER */}
      <header className="border-b border-white/5 bg-[#16191d]/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-8 h-24 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20">
              <Trophy size={24} className="text-white" />
            </Link>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tighter leading-none">Apex<span className="text-blue-500">Play</span></h1>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Live Tournament Arena</p>
            </div>
          </div>

          <div className="flex-1 max-w-md mx-8">
            <div className="relative group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="text"
                placeholder="Search tournaments or games..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 pl-14 pr-6 text-sm font-bold focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-gray-600"
              />
            </div>
          </div>

          <Link href="/dashboard" className="bg-white/5 hover:bg-white/10 px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
            Organizer Portal
          </Link>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-8 py-16">
        <div className="mb-12">
          <h2 className="text-5xl font-black uppercase tracking-tighter mb-4">Discover<br/><span className="text-blue-500 text-6xl">Tournaments</span></h2>
        </div>

        {filteredTournaments.length === 0 && !isLoading ? (
          <div className="bg-[#16191d] border border-white/5 rounded-[3rem] p-24 text-center">
            <Gamepad2 className="w-20 h-20 text-gray-800 mx-auto mb-6" />
            <h3 className="text-2xl font-black uppercase tracking-tighter text-white/50">
              {searchQuery ? "No Matches Found" : "No Ongoing Tournaments"}
            </h3>
            <p className="text-gray-600 font-bold uppercase tracking-widest text-[10px] mt-2">
              {searchQuery ? "Try refining your search" : "Check back later or start your own!"}
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
                  className="group relative h-[450px] rounded-[2.5rem] overflow-hidden border border-white/5 hover:border-blue-500/50 transition-all duration-500"
                >
                  {/* Banner Image */}
                  <div className="absolute inset-0 z-0">
                    <Image 
                      src={gameMeta?.bannerUrl || "/default-banner.jpg"} 
                      alt={t.game}
                      fill
                      className="object-cover grayscale-[0.5] group-hover:grayscale-0 group-hover:scale-110 transition-all duration-700"
                      style={{ objectPosition: gameMeta?.bannerPosition || 'center' }}
                      priority={index < 3}
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0d0f12] via-[#0d0f12]/40 to-transparent"></div>
                  </div>

                  {/* Content */}
                  <div className="relative z-10 h-full flex flex-col justify-end p-10">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 bg-white/10 backdrop-blur-md border border-white/10 rounded-xl flex items-center justify-center p-2 relative">
                        <Image 
                            src={gameMeta?.logoUrl || ''} 
                            fill 
                            className="object-contain" 
                            alt={t.game} 
                            sizes="48px"
                        />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 bg-blue-500/10 px-4 py-1.5 rounded-full border border-blue-500/20">
                        {gameMeta?.name}
                      </span>
                    </div>

                    <h3 className="text-3xl font-black uppercase tracking-tighter leading-tight mb-4 group-hover:text-blue-400 transition-colors">
                      {t.name}
                    </h3>

                    <div className="flex items-center gap-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      <div className="flex items-center gap-2">
                        <Users size={12} className="text-blue-500" />
                        <span>{t.teamSize}v{t.teamSize}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar size={12} className="text-blue-500" />
                        <span>Ongoing</span>
                      </div>
                    </div>

                    <div className="mt-8 flex items-center gap-2 text-white font-black uppercase tracking-widest text-[9px] group/btn">
                      <span>View Tournament</span>
                      <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform text-blue-500" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="border-t border-white/5 py-24 mt-24">
        <div className="max-w-[1400px] mx-auto px-8 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center mb-8">
            <Trophy size={32} className="text-blue-500" />
          </div>
          <h4 className="text-2xl font-black uppercase tracking-tighter mb-4">Elevate Your <span className="text-blue-500">Game</span></h4>
          <p className="text-gray-500 max-w-sm font-bold uppercase tracking-widest text-[10px] leading-relaxed">
            The ultimate platform for competitive gaming and tournament orchestration.
          </p>
          <div className="flex gap-12 mt-12 text-[10px] font-black uppercase tracking-[0.3em] text-gray-600">
            <span className="hover:text-white cursor-pointer transition-colors">Twitter</span>
            <span className="hover:text-white cursor-pointer transition-colors">Discord</span>
            <span className="hover:text-white cursor-pointer transition-colors">Support</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
