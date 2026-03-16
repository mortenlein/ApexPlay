import React from 'react';

export default function TournamentSkeleton() {
  return (
    <div className="flex h-screen bg-[#0d0f12] text-white overflow-hidden font-sans animate-pulse">
      {/* SIDEBAR SKELETON */}
      <aside className="w-20 bg-[#16191d] border-r border-white/5 flex flex-col items-center py-8 gap-10 shrink-0">
        <div className="w-12 h-12 bg-white/5 rounded-2xl"></div>
        <div className="flex flex-col gap-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="w-10 h-10 bg-white/5 rounded-xl"></div>
          ))}
        </div>
      </aside>

      {/* MAIN CONTENT SKELETON */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* HEADER SKELETON */}
        <header className="h-[300px] border-b border-white/5 bg-white/[0.02] p-16 flex items-center justify-between">
          <div className="flex items-center gap-10">
            <div className="w-24 h-24 bg-white/5 rounded-[2rem]"></div>
            <div className="space-y-4">
              <div className="w-32 h-6 bg-white/5 rounded-full"></div>
              <div className="w-96 h-16 bg-white/5 rounded-2xl"></div>
              <div className="flex gap-8">
                <div className="w-32 h-4 bg-white/5 rounded-full"></div>
                <div className="w-32 h-4 bg-white/5 rounded-full"></div>
              </div>
            </div>
          </div>
          <div className="w-48 h-16 bg-white/5 rounded-2xl"></div>
        </header>

        {/* CONTENT AREA SKELETON */}
        <div className="flex-1 p-12 overflow-hidden">
          <div className="max-w-6xl space-y-12">
            <div className="flex items-center gap-4">
              <div className="w-40 h-4 bg-white/5 rounded-full"></div>
              <div className="h-px flex-1 bg-white/5"></div>
            </div>
            
            <div className="grid grid-cols-2 gap-12">
               <div className="h-[400px] bg-white/5 rounded-[3rem]"></div>
               <div className="space-y-6">
                  <div className="h-1/2 bg-white/5 rounded-[2.5rem]"></div>
                  <div className="h-[calc(50%-1.5rem)] bg-white/5 rounded-[2.5rem]"></div>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDEBAR SKELETON */}
      <aside className="w-80 bg-[#16191d] border-l border-white/5 p-8 shrink-0 space-y-12">
         <div className="space-y-4">
            <div className="flex justify-between">
              <div className="w-32 h-3 bg-white/5 rounded-full"></div>
              <div className="w-8 h-3 bg-white/5 rounded-full"></div>
            </div>
            <div className="w-full h-2 bg-white/5 rounded-full"></div>
         </div>
         
         <div className="space-y-8">
            <div className="w-32 h-4 bg-white/5 rounded-full"></div>
            <div className="space-y-4">
               {[1, 2, 3].map((i) => (
                  <div key={i} className="h-32 bg-white/5 rounded-2xl"></div>
               ))}
            </div>
         </div>
      </aside>
    </div>
  );
}
