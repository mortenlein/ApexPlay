"use client";

import { useEffect } from "react";

/**
 * Dev-only render-budget tripwire: warns when the first frame after mount takes longer than
 * `budgetMs`. It is a no-op in production — the measurement is pure overhead there and the
 * console warning has no audience.
 */
export function usePerformanceBudget(label: string, budgetMs: number) {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      return;
    }

    const started = performance.now();
    const frame = requestAnimationFrame(() => {
      const elapsed = performance.now() - started;
      if (elapsed > budgetMs) {
        console.warn(`[perf-budget] ${label} exceeded ${budgetMs}ms budget (${Math.round(elapsed)}ms)`);
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [budgetMs, label]);
}
