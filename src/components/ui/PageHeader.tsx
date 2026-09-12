import React from "react";

/**
 * Standard page/section header: eyebrow + title + optional subtitle and right-side actions.
 *
 * The eyebrow is a *label* (uppercase, tracked); the title is set in the display face at the
 * user's own casing, so it is safe to pass a tournament name straight in.
 */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  meta,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  /** A status line under the title — badges, counts, a live marker. */
  meta?: React.ReactNode;
}) {
  return (
    <header className="workspace-header">
      <div className="min-w-0">
        {eyebrow && <p className="workspace-eyebrow">{eyebrow}</p>}
        <h1 className="workspace-title">{title}</h1>
        {subtitle && <p className="workspace-subtitle">{subtitle}</p>}
        {meta && <div className="mt-4 flex flex-wrap items-center gap-3">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </header>
  );
}
