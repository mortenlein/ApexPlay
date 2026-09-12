import React from "react";

/** Consistent empty/zero state used across lists and tables. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** e.g. `flex-1` so the panel fills a board column that has nothing in it yet. */
  className?: string;
}) {
  return (
    <div className={`mds-empty-state flex flex-col items-center justify-center gap-4 ${className}`}>
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-line bg-tint text-fg-subtle">
          {icon}
        </div>
      )}
      <div className="space-y-1.5">
        <h3 className="mds-card-title">{title}</h3>
        {description && (
          <p className="mx-auto max-w-md text-body text-fg-muted">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
