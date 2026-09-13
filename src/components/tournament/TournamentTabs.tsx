"use client";

import React from "react";
import { getTournamentTabItems } from "./tournament-tabs-config";

interface TournamentTabsProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  tournamentCategory: string;
}

/**
 * The one set of tournament tabs on desktop. This used to be a 288px "TOURNAMENT MENU" rail
 * stacked under the app's own persistent header — two navigations on one page. It is now a
 * single strip under the hero; on phones the bottom tab bar in TournamentView takes over.
 */
export function TournamentTabs({ activeTab, setActiveTab, tournamentCategory }: TournamentTabsProps) {
  const tabs = getTournamentTabItems(tournamentCategory);

  return (
    <nav
      aria-label="Tournament sections"
      className="hidden shrink-0 border-b border-line bg-card lg:block"
    >
      <div className="mx-auto flex max-w-content items-stretch gap-1 px-10" role="tablist">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              data-testid={`tournament-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-[13px] font-semibold transition-colors ${
                active
                  ? "border-brand text-brand"
                  : "border-transparent text-fg-muted hover:text-fg"
              }`}
            >
              <tab.icon size={15} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
