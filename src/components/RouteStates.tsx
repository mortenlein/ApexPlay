"use client";

import Link from "next/link";
import { AlertTriangle, RefreshCw, SearchX } from "lucide-react";

export function RouteLoadingState({ label }: { label: string }) {
  return (
    <div className="min-h-screen bg-[var(--mds-page)] flex items-center justify-center p-6">
      <div className="flex flex-col items-center gap-5 rounded-xl border border-[var(--mds-border)] bg-[var(--mds-card)] px-8 py-10 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--mds-action)] border-t-transparent" />
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--mds-text-muted)]">Loading {label}</p>
      </div>
    </div>
  );
}

export function RouteErrorState({
  title,
  description,
  retryLabel = "Retry",
}: {
  title: string;
  description: string;
  retryLabel?: string;
}) {
  return (
    <div className="min-h-screen bg-[var(--mds-page)] flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-xl border border-[var(--mds-border)] bg-[var(--mds-card)] p-8">
        <div className="flex items-center gap-3 text-[var(--mds-red)]">
          <AlertTriangle size={18} />
          <p className="text-xs font-black uppercase tracking-[0.16em]">{title}</p>
        </div>
        <p className="mt-3 text-sm text-[var(--mds-text-muted)]">{description}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mds-btn-primary mt-6 h-10 px-5 text-[10px] font-black uppercase tracking-widest"
        >
          <RefreshCw size={14} />
          {retryLabel}
        </button>
      </div>
    </div>
  );
}

export function RouteNotFoundState({
  title,
  description,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: {
  title: string;
  description: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <div className="min-h-screen bg-[var(--mds-page)] flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-xl border border-[var(--mds-border)] bg-[var(--mds-card)] p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--mds-border)] bg-[var(--mds-input)] text-[var(--mds-text-subtle)]">
          <SearchX size={20} />
        </div>
        <h1 className="mt-5 text-2xl font-black uppercase tracking-tight">{title}</h1>
        <p className="mt-3 text-sm text-[var(--mds-text-muted)]">{description}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href={primaryHref} className="mds-btn-primary h-10 px-5 text-[10px] font-black uppercase tracking-widest">
            {primaryLabel}
          </Link>
          {secondaryHref && secondaryLabel ? (
            <Link href={secondaryHref} className="mds-btn-secondary h-10 px-5 text-[10px] font-black uppercase tracking-widest">
              {secondaryLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
