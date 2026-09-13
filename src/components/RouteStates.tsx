"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { AlertTriangle, RefreshCw, SearchX } from "lucide-react";

/**
 * The three things a route can be instead of itself: loading, broken, or missing.
 *
 * They share one shape — a single centred panel on the page surface — so a visitor who hits
 * one recognises it as the app rather than as a crash. All three are built from tokens; none
 * of them invents a size or a colour.
 */

export function RouteLoadingState({ label }: { label: string }) {
  const t = useTranslations("common");
  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-page p-6">
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center gap-5 rounded-lg border border-line bg-card px-8 py-10 text-center"
      >
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        <p className="mds-uppercase-label text-fg-muted">{t("loadingThing", { thing: label })}</p>
      </div>
    </div>
  );
}

export function RouteErrorState({
  title,
  description,
  retryLabel,
}: {
  title: string;
  description: string;
  retryLabel?: string;
}) {
  const t = useTranslations("common");
  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-page p-6">
      <div role="alert" className="w-full max-w-xl rounded-lg border border-line bg-card p-8">
        <div className="flex items-center gap-2.5 text-danger">
          <AlertTriangle size={18} aria-hidden />
          <p className="mds-uppercase-label text-danger">{t("somethingWentWrong")}</p>
        </div>
        <h1 className="mds-name-lg mt-3">{title}</h1>
        <p className="mt-2 text-body text-fg-muted">{description}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mds-btn-primary mds-tap mt-6 h-10 px-5 text-label font-bold uppercase tracking-widest"
        >
          <RefreshCw size={14} aria-hidden />
          {retryLabel ?? t("retry")}
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
    <div className="flex min-h-[70vh] items-center justify-center bg-page p-6">
      <div className="w-full max-w-xl rounded-lg border border-line bg-card p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-line bg-tint text-fg-subtle">
          <SearchX size={20} aria-hidden />
        </div>
        <h1 className="mds-name-lg mt-5">{title}</h1>
        <p className="mt-2 text-body text-fg-muted">{description}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href={primaryHref}
            className="mds-btn-primary mds-tap h-10 px-5 text-label font-bold uppercase tracking-widest"
          >
            {primaryLabel}
          </Link>
          {secondaryHref && secondaryLabel ? (
            <Link
              href={secondaryHref}
              className="mds-btn-secondary mds-tap h-10 px-5 text-label font-bold uppercase tracking-widest"
            >
              {secondaryLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
