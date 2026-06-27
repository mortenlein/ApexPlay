import React from 'react';

// The WorkspaceChrome shell has been retired in favor of ui/TopNav (one header per surface).
// These section helpers remain in use by the admin/manage content panels.

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
