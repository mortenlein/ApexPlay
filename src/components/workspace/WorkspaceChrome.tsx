'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, LucideIcon, MoreHorizontal, Command } from 'lucide-react';
import { ContextBar } from '@/components/ContextBar';
import { isActivePath, NavMatchMode } from '@/lib/navigation';
import { openCommandPalette } from '@/components/CommandPalette';
import { WorkspaceErrorBoundary } from '@/components/workspace/WorkspaceErrorBoundary';

interface NavItem {
  href?: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
  onClick?: () => void;
  matchMode?: NavMatchMode;
}

function isItemActive(item: NavItem, pathname: string) {
  if (typeof item.active === 'boolean') {
    return item.active;
  }

  if (!item.href) {
    return false;
  }

  return isActivePath(pathname, item.href, item.matchMode || 'prefix');
}

export function WorkspaceChrome({
  mode,
  navLabel,
  navItems,
  title,
  subtitle,
  actions,
  children,
  footer,
}: {
  mode: 'admin' | 'public' | 'marshal';
  navLabel: string;
  navItems: NavItem[];
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const pathname = usePathname();
  const breadcrumbs = React.useMemo(() => pathname.split('/').filter(Boolean).map((part) => part.replace(/-/g, ' ')), [pathname]);
  const phase = pathname.includes('/tournaments/') ? 'Tournament Ops' : mode === 'marshal' ? 'Floor Control' : mode === 'admin' ? 'Control Center' : 'Player Desk';
  const [showMore, setShowMore] = React.useState(false);
  const primaryMobileItems = navItems.slice(0, 4);
  const overflowMobileItems = navItems.slice(4);

  const renderNavItem = (item: NavItem, key: string | number, extraClass = '') => {
    const Icon = item.icon;
    const active = isItemActive(item, pathname);
    const content = (
      <>
        <Icon size={16} className={active ? 'text-[var(--mds-action)]' : 'text-[var(--mds-text-subtle)]'} />
        <span>{item.label}</span>
        {active ? <ChevronRight size={14} className="ml-auto text-[var(--mds-action)]" /> : null}
      </>
    );

    if (item.href) {
      return (
        <Link key={key} href={item.href} className={`mds-nav-link ${active ? 'active' : ''} ${extraClass}`.trim()}>
          {content}
        </Link>
      );
    }

    return (
      <button key={key} type="button" onClick={item.onClick} className={`mds-nav-link w-full text-left ${active ? 'active' : ''} ${extraClass}`.trim()}>
        {content}
      </button>
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-[var(--mds-page)] text-[var(--mds-text-primary)]">
      <ContextBar mode={mode} breadcrumbs={breadcrumbs} phase={phase} contextLabel={title} />
      <div className="flex flex-1 overflow-hidden pb-16 xl:pb-0">
        <aside className="hidden w-72 shrink-0 border-r border-[var(--mds-border)] bg-[var(--mds-card)] xl:flex xl:flex-col">
          <div className="border-b border-[var(--mds-border)] px-6 py-6">
            <p className="mds-uppercase-label">{navLabel}</p>
          </div>
          <nav className="flex-1 space-y-2 p-4">{navItems.map((item, index) => renderNavItem(item, `${item.label}-${index}`))}</nav>
          {footer ? <div className="border-t border-[var(--mds-border)] p-4">{footer}</div> : null}
        </aside>

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="workspace-header">
            <div>
              <p className="workspace-eyebrow">{navLabel}</p>
              <h1 className="workspace-title">{title}</h1>
              <p className="workspace-subtitle">{subtitle}</p>
            </div>
            {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
          </header>

          <div className="workspace-content">
            <WorkspaceErrorBoundary>{children}</WorkspaceErrorBoundary>
          </div>
        </main>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-[120] border-t border-[var(--mds-border)] bg-[var(--mds-card)] px-2 py-2 xl:hidden">
        <div className="grid grid-cols-5 gap-2">
          {primaryMobileItems.map((item, index) => {
            const Icon = item.icon;
            const active = isItemActive(item, pathname);
            if (item.href) {
              return (
                <Link
                  key={`mobile-${item.label}-${index}`}
                  href={item.href}
                  data-testid={`workspace-mobile-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  className={`flex h-12 flex-col items-center justify-center rounded-lg text-[9px] font-bold uppercase tracking-wider ${active ? 'bg-[var(--mds-action-soft)] text-[var(--mds-action)]' : 'text-[var(--mds-text-muted)]'}`}
                >
                  <Icon size={16} />
                  <span className="mt-1 truncate">{item.label}</span>
                </Link>
              );
            }

            return (
              <button
                key={`mobile-${item.label}-${index}`}
                type="button"
                onClick={item.onClick}
                data-testid={`workspace-mobile-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                className={`flex h-12 flex-col items-center justify-center rounded-lg text-[9px] font-bold uppercase tracking-wider ${active ? 'bg-[var(--mds-action-soft)] text-[var(--mds-action)]' : 'text-[var(--mds-text-muted)]'}`}
              >
                <Icon size={16} />
                <span className="mt-1 truncate">{item.label}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setShowMore(true)}
            data-testid="workspace-mobile-nav-more"
            className="flex h-12 flex-col items-center justify-center rounded-lg text-[9px] font-bold uppercase tracking-wider text-[var(--mds-text-muted)]"
          >
            <MoreHorizontal size={16} />
            <span className="mt-1">More</span>
          </button>
        </div>
      </div>

      {showMore ? (
        <div className="fixed inset-0 z-[220] bg-black/50 p-4 backdrop-blur-sm xl:hidden" onClick={() => setShowMore(false)}>
          <div data-testid="workspace-mobile-more-sheet" className="mx-auto mt-[20vh] w-full max-w-md rounded-xl border border-[var(--mds-border)] bg-[var(--mds-card)] p-3" onClick={(event) => event.stopPropagation()}>
            <p className="px-3 pb-2 pt-1 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--mds-text-subtle)]">More Actions</p>
            <div className="space-y-1">
              {overflowMobileItems.map((item, index) => (
                <div key={`overflow-${item.label}-${index}`} onClick={() => setShowMore(false)}>
                  {renderNavItem(item, `overflow-link-${index}`)}
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  setShowMore(false);
                  openCommandPalette();
                }}
                data-testid="workspace-open-command-palette"
                className="mds-nav-link w-full text-left"
              >
                <Command size={16} className="text-[var(--mds-text-subtle)]" />
                <span>Command Palette</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PanelHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-[var(--mds-border)] pb-5 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow ? <p className="workspace-eyebrow">{eyebrow}</p> : null}
        <h2 className="text-xl font-black tracking-tight text-[var(--mds-text-primary)]">{title}</h2>
        {description ? <p className="mt-2 max-w-2xl text-sm text-[var(--mds-text-muted)]">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mds-empty-state">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--mds-border)] bg-[var(--mds-input)] text-[var(--mds-text-muted)]">
        {icon}
      </div>
      <h3 className="text-lg font-black tracking-tight text-[var(--mds-text-primary)]">{title}</h3>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[var(--mds-text-muted)]">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function InlineNotice({
  tone = 'info',
  title,
  description,
}: {
  tone?: 'info' | 'warning' | 'success';
  title: string;
  description: string;
}) {
  return (
    <div className={`mds-inline-notice ${tone}`}>
      <p className="text-xs font-black uppercase tracking-[0.18em]">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-[var(--mds-text-muted)]">{description}</p>
    </div>
  );
}
