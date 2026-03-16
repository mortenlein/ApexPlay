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
    <div className="bg-[#16191d] border border-white/5 rounded-[2rem] p-6 shadow-2xl relative overflow-hidden group hover:border-blue-500/30 transition-all duration-300">
      <div className="absolute top-0 right-0 p-4">
        <span className="px-3 py-1 bg-red-500/10 text-red-500 text-[8px] font-black uppercase rounded-full border border-red-500/20 tracking-widest shadow-[0_0_15px_rgba(239,68,68,0.1)]">LIVE NOW</span>
      </div>
      
      <div className="flex justify-between items-center mb-10 pt-4 px-2">
        <div className="flex flex-col items-center flex-1 text-center group">
          <div className="w-16 h-16 bg-black/40 rounded-2xl flex items-center justify-center mb-4 border border-white/5 group-hover:border-blue-500/50 group-hover:bg-black/60 transition-all duration-500 transform group-hover:-translate-y-1 overflow-hidden relative">
            {match.homeTeam?.logoUrl ? (
                <Image src={match.homeTeam.logoUrl} alt="" fill className="object-contain" />
            ) : (
                <Trophy size={28} className="text-gray-600 group-hover:text-blue-500" />
            )}
          </div>
          <span className="text-[14px] font-extrabold uppercase tracking-tighter truncate w-full group-hover:text-white transition-all">
            {match.homeTeam?.name || "Pending..."}
          </span>
          <span className="text-[9px] font-bold text-gray-700 uppercase tracking-widest mt-1">HOME TEAM</span>
        </div>

        <div className="flex flex-col items-center px-6">
          <div className="flex items-center gap-3">
             <span className="text-4xl font-extrabold text-white font-mono tracking-tighter tabular-nums drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">
               {match.homeScore}
             </span>
             <span className="text-xl font-extrabold text-gray-800">:</span>
             <span className="text-4xl font-extrabold text-white font-mono tracking-tighter tabular-nums drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">
               {match.awayScore}
             </span>
          </div>
          <span className="text-[9px] font-black text-blue-500 bg-blue-500/10 px-3 py-1 rounded-full uppercase tracking-[0.2em] mt-6 border border-blue-500/20 shadow-[inset_0_0_10px_rgba(59,130,246,0.1)]">
            BO{match.bestOf} &bull; ROUND {match.round}
          </span>
        </div>

        <div className="flex flex-col items-center flex-1 text-center group">
          <div className="w-16 h-16 bg-black/40 rounded-2xl flex items-center justify-center mb-4 border border-white/5 group-hover:border-blue-500/50 group-hover:bg-black/60 transition-all duration-500 transform group-hover:-translate-y-1 overflow-hidden relative">
            {match.awayTeam?.logoUrl ? (
                <Image src={match.awayTeam.logoUrl} alt="" fill className="object-contain" />
            ) : (
                <Trophy size={28} className="text-gray-600 group-hover:text-blue-500" />
            )}
          </div>
          <span className="text-[14px] font-extrabold uppercase tracking-tighter truncate w-full group-hover:text-white transition-all">
            {match.awayTeam?.name || "Pending..."}
          </span>
          <span className="text-[9px] font-bold text-gray-700 uppercase tracking-widest mt-1">AWAY TEAM</span>
        </div>
      </div>

      <Link 
        href={`/bracket/${tournamentId}/overlay`}
        target="_blank"
        className="w-full bg-white/5 hover:bg-white/[0.08] py-4 rounded-xl flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all border border-white/5 active:scale-[0.98] group"
      >
        <Play size={12} fill="currentColor" className="text-blue-500 group-hover:scale-110 transition-transform" /> 
        Watch LIVE Match
      </Link>
    </div>
  );
};

export default LiveMatchCard;
