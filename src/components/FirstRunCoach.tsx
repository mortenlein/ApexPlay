"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Lightbulb, X } from "lucide-react";

interface FirstRunCoachProps {
  id: string;
  title: string;
  steps: string[];
  cta?: React.ReactNode;
}

export default function FirstRunCoach({ id, title, steps, cta }: FirstRunCoachProps) {
  const t = useTranslations("organizer.coach");
  const key = `summit-onboarding-${id}`;
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
    <div className="mds-card border-[var(--mds-action)]/30 bg-[var(--mds-action-soft)] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Lightbulb size={16} className="mt-0.5 shrink-0 text-[var(--mds-action)]" />
          <div>
            <p className="mds-uppercase-label text-[var(--mds-action)]">{t("eyebrow")}</p>
            <h3 className="mt-0.5 text-base font-bold tracking-tight">{title}</h3>
            <ul className="mt-2 space-y-1 text-sm text-[var(--mds-text-muted)]">
              {steps.map((step) => (
                <li key={step} className="flex gap-2">
                  <span aria-hidden className="text-[var(--mds-text-subtle)]">·</span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
            {cta ? <div className="mt-3">{cta}</div> : null}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            window.localStorage.setItem(key, "dismissed");
            setVisible(false);
          }}
          className="rounded-md border border-[var(--mds-border)] p-1 text-[var(--mds-text-subtle)] transition-colors hover:text-[var(--mds-text-primary)]"
          aria-label={t("dismiss")}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
