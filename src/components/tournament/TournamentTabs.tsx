"use client";

import React from "react";
import { getTournamentTabItems } from "./tournament-tabs-config";

interface TournamentTabsProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  tournamentCategory: string;
}

export function TournamentTabs({ activeTab, setActiveTab, tournamentCategory }: TournamentTabsProps) {
  const tabs = getTournamentTabItems(tournamentCategory);

  return (
    <nav className="flex flex-col gap-2 p-6 lg:p-10 border-b border-[var(--mds-border)] md:border-none md:p-8">
      <div className="mds-uppercase-label px-4 mb-4 text-[11px] font-black opacity-30 tracking-[0.2em]">Tournament Menu</div>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`mds-nav-link w-full text-left font-black uppercase tracking-widest text-[12px] group ${activeTab === tab.id ? "active shadow-lg shadow-[var(--mds-action-soft)] border border-[var(--mds-action)]/20" : "border border-transparent"}`}
        >
          <tab.icon size={16} className={`group-hover:scale-110 transition-transform ${activeTab === tab.id ? "text-[var(--mds-action)]" : "text-[var(--mds-text-subtle)]"}`} />
          <span>{tab.label}</span>
          {activeTab === tab.id && (
            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--mds-action)] shadow-[0_0_8px_var(--mds-action)]" />
          )}
        </button>
      ))}
    </nav>
  );
}
