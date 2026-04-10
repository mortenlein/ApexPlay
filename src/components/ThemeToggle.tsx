"use client";

import React, { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return (
    <div className="h-9 w-9 rounded-mds-comfortable bg-[var(--mds-action-soft)] animate-pulse" />
  );

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="flex h-9 w-9 items-center justify-center rounded-mds-comfortable border border-[var(--mds-border)] bg-[var(--mds-page)] text-[var(--mds-text-muted)] transition-all hover:bg-[var(--mds-action-soft)] hover:text-[var(--mds-action)] shadow-mds-whisper"
      aria-label="Toggle Theme"
    >
      {theme === "dark" ? (
        <Sun size={18} strokeWidth={2.5} className="animate-in zoom-in-50 duration-300" />
      ) : (
        <Moon size={18} strokeWidth={2.5} className="animate-in zoom-in-50 duration-300" />
      )}
    </button>
  );
}
