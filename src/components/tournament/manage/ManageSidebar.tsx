'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Activity, Users, Sword, Settings2, ExternalLink, X } from 'lucide-react';

interface ManageSidebarProps {
  tournamentId: string;
  activeTab: string;
  onTabChange: (tab: string) => void;
  isMenuOpen: boolean;
  setIsMenuOpen: (open: boolean) => void;
  category: string;
}

export const ManageSidebar: React.FC<ManageSidebarProps> = ({
  tournamentId,
  activeTab,
  onTabChange,
  isMenuOpen,
  setIsMenuOpen,
  category
}) => {
  const tabs = [
    { id: "overview", icon: Activity, label: "Overview" },
    { id: "participants", icon: Users, label: "Teams" },
    { id: category === 'BATTLE_ROYALE' ? "scoreboard" : "matches", icon: Sword, label: "Matches" },
    { id: "settings", icon: Settings2, label: "Settings" },
  ];

  return (
    <aside className={`fixed inset-y-0 left-0 z-[100] w-72 bg-[var(--mds-card)] border-r border-[var(--mds-border)] backdrop-blur-xl transition-transform duration-300 md:relative md:translate-x-0 ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex flex-col h-full py-8 px-6 gap-10">
        <div className="flex items-center justify-between mb-2">
          <Link href="/admin" className="flex items-center gap-4 group">
            <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-[var(--mds-input)] border border-[var(--mds-border)] group-hover:border-[var(--mds-action)]/40 transition-all shadow-sm">
              <ArrowLeft size={16} className="group-hover:text-[var(--mds-action)]" />
            </div>
            <span className="mds-uppercase-label opacity-40 group-hover:opacity-100 transition-opacity">All tournaments</span>
          </Link>
          <button onClick={() => setIsMenuOpen(false)} className="md:hidden p-2 hover:bg-[var(--mds-border)]/20 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <nav className="flex flex-col gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                onTabChange(tab.id);
                setIsMenuOpen(false);
              }}
              className={`flex items-center gap-4 px-4 py-3.5 rounded-lg transition-all font-bold text-sm ${
                activeTab === tab.id 
                  ? 'bg-[var(--mds-action-soft)] text-[var(--mds-action)] border border-[var(--mds-action)]/20 shadow-sm' 
                  : 'text-[var(--mds-text-muted)] hover:text-[var(--mds-text-primary)] hover:bg-[var(--mds-input)]'
              }`}
            >
              <tab.icon size={18} />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="mt-auto space-y-4">
          <Link 
            href={`/tournaments/${tournamentId}`} 
            target="_blank" 
            className="flex items-center gap-4 px-4 py-3.5 rounded-lg text-[var(--mds-text-muted)] hover:text-[var(--mds-text-primary)] transition-all font-bold text-sm group"
          >
            <ExternalLink size={18} className="group-hover:translate-x-0.5 transition-transform" />
            <span>Open Public Page</span>
          </Link>
        </div>
      </div>
    </aside>
  );
};
