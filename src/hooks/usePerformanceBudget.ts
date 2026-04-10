"use client";

import { useEffect } from "react";

export function usePerformanceBudget(label: string, budgetMs: number) {
  useEffect(() => {
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
