"use client";

import React from "react";
import { Lightbulb, X } from "lucide-react";

interface FirstRunCoachProps {
  id: string;
  title: string;
  steps: string[];
  cta?: React.ReactNode;
}

export default function FirstRunCoach({ id, title, steps, cta }: FirstRunCoachProps) {
  const key = `apexplay-onboarding-${id}`;
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissed = window.localStorage.getItem(key);
    if (!dismissed) {
      setVisible(true);
    }
  }, [key]);

  if (!visible) {
    return null;
  }

  return (
    <div className="mds-card border-[var(--mds-action)]/30 bg-[var(--mds-action-soft)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Lightbulb size={18} className="mt-0.5 text-[var(--mds-action)]" />
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--mds-action)]">First-run guide</p>
            <h3 className="mt-1 text-lg font-black tracking-tight">{title}</h3>
            <div className="mt-3 space-y-2 text-sm text-[var(--mds-text-muted)]">
              {steps.map((step) => (
                <p key={step}>- {step}</p>
              ))}
            </div>
            {cta ? <div className="mt-4">{cta}</div> : null}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            window.localStorage.setItem(key, "dismissed");
            setVisible(false);
          }}
          className="rounded-md border border-[var(--mds-border)] p-1 text-[var(--mds-text-subtle)] hover:text-[var(--mds-text-primary)]"
          aria-label="Dismiss onboarding"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
