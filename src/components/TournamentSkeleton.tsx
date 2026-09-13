import React from 'react';

/**
 * Mirrors the real page's shape so nothing jumps when the data lands: a compact hero band, one
 * row of tabs, the content column and the score rail.
 */
export default function TournamentSkeleton() {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden bg-page animate-pulse">
      {/* HERO BAND */}
      <header className="shrink-0 border-b border-line bg-card px-4 py-4 lg:px-10 lg:py-5">
        <div className="mx-auto flex max-w-content items-center gap-4">
          <div className="hidden h-11 w-11 rounded bg-line sm:block" />
          <div className="flex-1 space-y-2">
            <div className="h-6 w-64 rounded bg-line" />
            <div className="h-3 w-48 rounded bg-line" />
          </div>
          <div className="hidden h-9 w-24 rounded bg-line sm:block" />
        </div>
      </header>

      {/* TABS */}
      <div className="hidden shrink-0 border-b border-line bg-card px-10 lg:block">
        <div className="mx-auto flex max-w-content gap-6 py-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-4 w-20 rounded bg-line" />
          ))}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden px-4 py-6 lg:px-10">
          <div className="mx-auto max-w-content space-y-6">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-40 rounded-lg border border-line bg-line" />
              ))}
            </div>
            <div className="h-72 rounded-lg border border-line bg-line" />
          </div>
        </div>

        <aside className="hidden w-72 shrink-0 flex-col gap-6 border-l border-line bg-card p-5 lg:flex">
          <div className="h-12 rounded bg-line" />
          <div className="h-28 rounded bg-line" />
          <div className="h-40 rounded bg-line" />
        </aside>
      </div>
    </div>
  );
}
