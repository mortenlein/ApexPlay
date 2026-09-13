'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { ArrowLeft, Activity, Users, Sword, Settings2, ExternalLink, X, LayoutGrid } from 'lucide-react';

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
  const t = useTranslations('organizer.sidebar');
  const tabs = [
    { id: "control", icon: LayoutGrid, label: t('control') },
    { id: "overview", icon: Activity, label: t('overview') },
    { id: "participants", icon: Users, label: t('teams') },
    { id: category === 'BATTLE_ROYALE' ? "scoreboard" : "matches", icon: Sword, label: t('matches') },
    { id: "settings", icon: Settings2, label: t('settings') },
  ];

  return (
    <aside className={`fixed inset-y-0 left-0 z-[100] w-64 bg-[var(--mds-card)] border-r border-[var(--mds-border)] backdrop-blur-xl transition-transform duration-300 md:relative md:translate-x-0 ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex h-full flex-col gap-8 px-4 py-6">
        <div className="flex items-center justify-between mb-2">
          <Link href="/admin" className="group flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--mds-border)] bg-[var(--mds-input)] transition-all group-hover:border-[var(--mds-action)]/40">
              <ArrowLeft size={16} className="group-hover:text-[var(--mds-action)]" />
            </div>
            <span className="mds-uppercase-label transition-colors group-hover:text-[var(--mds-text-primary)]">{t('allTournaments')}</span>
          </Link>
          <button onClick={() => setIsMenuOpen(false)} className="md:hidden p-2 hover:bg-[var(--mds-border)]/20 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <nav className="flex flex-col gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                onTabChange(tab.id);
                setIsMenuOpen(false);
              }}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all ${
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
            className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-[var(--mds-text-muted)] transition-all hover:text-[var(--mds-text-primary)]"
          >
            <ExternalLink size={18} className="group-hover:translate-x-0.5 transition-transform" />
            <span>{t('openPublicPage')}</span>
          </Link>
        </div>
      </div>
    </aside>
  );
};
