import React from 'react';

export default function TournamentSkeleton() {
  return (
    <div className="flex h-screen bg-[var(--mds-page)] overflow-hidden animate-pulse">
      {/* SIDEBAR SKELETON */}
      <aside className="w-72 bg-[var(--mds-input)]/40 border-r border-[var(--mds-border)] flex flex-col py-10 px-8 gap-12 shrink-0">
        <div className="w-12 h-12 bg-[var(--mds-border)]/20 rounded-mds-comfortable"></div>
        <div className="flex flex-col gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="w-full h-10 bg-[var(--mds-border)]/10 rounded-mds-comfortable"></div>
          ))}
        </div>
      </aside>

      {/* MAIN COMMAND CONSOLE SKELETON */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* HEADER MONITOR SKELETON */}
        <header className="h-44 border-b border-[var(--mds-border)] bg-[var(--mds-input)]/20 p-10 flex flex-col justify-center gap-6">
          <div className="flex items-center gap-4">
            <div className="w-24 h-6 bg-[var(--mds-border)]/20 rounded-mds-comfortable"></div>
            <div className="w-16 h-4 bg-[var(--mds-border)]/10 rounded-mds-comfortable"></div>
          </div>
          <div className="flex items-end justify-between">
            <div className="w-[500px] h-12 bg-[var(--mds-border)]/20 rounded-mds-comfortable"></div>
            <div className="flex gap-4">
                <div className="w-40 h-10 bg-[var(--mds-border)]/20 rounded-mds-comfortable"></div>
                <div className="w-40 h-10 bg-[var(--mds-border)]/10 rounded-mds-comfortable"></div>
            </div>
          </div>
        </header>

        {/* OPERATIONAL INTERFACE SKELETON */}
        <div className="flex-1 p-12 overflow-hidden">
          <div className="max-w-[1400px] mx-auto space-y-12">
            <div className="grid grid-cols-3 gap-8">
               {[1, 2, 3].map(i => (
                  <div key={i} className="h-28 bg-[var(--mds-border)]/10 rounded-mds-card border border-[var(--mds-border)]/20"></div>
               ))}
            </div>
            
            <div className="flex items-center gap-6">
               <div className="w-48 h-5 bg-[var(--mds-border)]/20 rounded-mds-comfortable"></div>
               <div className="h-px flex-1 bg-[var(--mds-border)]/30"></div>
            </div>

            <div className="grid grid-cols-12 gap-10">
               <div className="col-span-8 space-y-8">
                  <div className="h-[450px] bg-[var(--mds-border)]/10 rounded-mds-card border border-[var(--mds-border)]/20"></div>
               </div>
               <div className="col-span-4 space-y-8">
                  <div className="h-64 bg-[var(--mds-border)]/10 rounded-mds-card border border-[var(--mds-border)]/20"></div>
                  <div className="h-48 bg-[var(--mds-border)]/10 rounded-mds-card border border-[var(--mds-border)]/20"></div>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
