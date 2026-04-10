"use client";

import React from "react";

interface State {
  hasError: boolean;
}

export class WorkspaceErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("workspace-error-boundary", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-2xl rounded-xl border border-[var(--mds-border)] bg-[var(--mds-card)] p-8 text-center">
          <h2 className="text-xl font-black uppercase tracking-tight">Workspace Error</h2>
          <p className="mt-2 text-sm text-[var(--mds-text-muted)]">Something went wrong in this workspace panel. Reload to continue.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mds-btn-primary mt-5 h-10 px-5 text-[10px] font-black uppercase tracking-widest"
          >
            Reload Workspace
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
