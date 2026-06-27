import React from "react";

/** Consistent empty/zero state used across lists and tables. */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mds-empty-state flex flex-col items-center gap-3">
      {icon && <div className="text-fg-subtle">{icon}</div>}
      <div className="space-y-1">
        <h3 className="text-base font-bold text-fg">{title}</h3>
        {description && (
          <p className="text-sm text-fg-muted max-w-md mx-auto">{description}</p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
