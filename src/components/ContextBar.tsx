"use client";

import React from 'react';
import { usePathname } from 'next/navigation';
import { Shield, Globe, ArrowRight, Lock, Radio } from 'lucide-react';
import Link from 'next/link';

type BreadcrumbInput = string | { label: string; href?: string };

interface ContextBarProps {
  mode: 'admin' | 'public' | 'marshal';
  breadcrumbs?: BreadcrumbInput[];
  phase?: string;
  contextLabel?: string;
}

export const ContextBar: React.FC<ContextBarProps> = ({ mode, breadcrumbs = [], phase, contextLabel }) => {
  const pathname = usePathname();
  const accentColor =
    mode === 'admin' ? 'var(--mds-action)' : mode === 'marshal' ? 'var(--mds-green)' : 'var(--mds-text-muted)';
  const label =
    mode === 'admin' ? 'Admin Workspace' : mode === 'marshal' ? 'Marshal Board' : 'Player View';
  const subLabel =
    mode === 'admin'
      ? 'Run tournaments, brackets, and live operations'
      : mode === 'marshal'
        ? 'Track seats, readiness, and recent alerts'
        : 'Browse tournaments and your current matches';
  const Icon = mode === 'admin' ? Shield : mode === 'marshal' ? Radio : Globe;
  const isAdmin = mode === 'admin';
  const isMarshal = mode === 'marshal';
  const pathSegments = pathname.split('/').filter(Boolean);
  const resolvedCrumbs = breadcrumbs.map((crumb, index) => {
    if (typeof crumb === 'string') {
      return {
        label: crumb,
        href: index < pathSegments.length ? `/${pathSegments.slice(0, index + 1).join('/')}` : undefined,
      };
    }

    return crumb;
  });

  return (
    <div className="h-9 w-full bg-[var(--mds-context-bar)] border-b border-[var(--mds-border)] flex items-center justify-between px-6 z-[100] relative overflow-hidden">
      {/* Decorative Accent Glow */}
      <div 
        className="absolute bottom-0 left-0 h-[1px] w-full opacity-50"
        style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }}
      />
      
      <div className="flex items-center gap-4 min-w-0">
        <div className="flex items-center gap-2">
          <Icon size={14} style={{ color: accentColor }} />
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--mds-text-primary)] truncate">
            {label}
            <span className="mx-3 opacity-20 text-white font-normal">|</span>
            <span className="opacity-50 font-medium lowercase tracking-normal">{subLabel}</span>
            {contextLabel ? (
              <>
                <span className="mx-3 opacity-20 text-white font-normal">|</span>
                <span className="opacity-80 tracking-[0.08em]">{contextLabel}</span>
              </>
            ) : null}
            {phase ? (
              <>
                <span className="mx-3 opacity-20 text-white font-normal">|</span>
                <span className="text-[var(--mds-action)]">{phase}</span>
              </>
            ) : null}
            {resolvedCrumbs.length > 0 ? (
              <>
                <span className="mx-3 opacity-20 text-white font-normal">|</span>
                <span className="inline-flex items-center gap-1 normal-case tracking-normal">
                  {resolvedCrumbs.map((crumb, index) => {
                    const isLast = index === resolvedCrumbs.length - 1;
                    const canLink = Boolean(crumb.href) && !isLast;
                    return (
                      <React.Fragment key={`${crumb.label}-${index}`}>
                        {canLink ? (
                          <Link href={crumb.href!} className="opacity-80 hover:opacity-100 hover:text-[var(--mds-action)] transition-colors">
                            {crumb.label}
                          </Link>
                        ) : (
                          <span className={isLast ? 'opacity-95 text-[var(--mds-text-primary)]' : 'opacity-80'}>{crumb.label}</span>
                        )}
                        {!isLast ? <span className="opacity-30">/</span> : null}
                      </React.Fragment>
                    );
                  })}
                </span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6">
        {isAdmin ? (
          <Link 
            href="/tournaments" 
            className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-[var(--mds-text-muted)] hover:text-[var(--mds-admin-accent)] transition-all group"
          >
            <span>Open Public Site</span>
            <ArrowRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
        ) : isMarshal ? (
          <Link 
            href="/admin" 
            className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-[var(--mds-text-muted)] hover:text-[var(--mds-green)] transition-all group"
          >
            <span>Open Admin</span>
            <ArrowRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
        ) : (
          <Link 
            href="/login" 
            className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-[var(--mds-text-muted)] hover:text-[var(--mds-public-accent)] transition-all group"
          >
            <Lock size={10} />
            <span>Admin Login</span>
          </Link>
        )}
      </div>
    </div>
  );
};
