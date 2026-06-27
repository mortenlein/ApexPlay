import React from "react";

/** Standard page/section header: eyebrow + title + optional subtitle and right-side actions. */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="workspace-header">
      <div>
        {eyebrow && <p className="workspace-eyebrow">{eyebrow}</p>}
        <h1 className="workspace-title">{title}</h1>
        {subtitle && <p className="workspace-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </header>
  );
}
