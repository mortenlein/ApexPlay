"use client";

import React, { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Sun, Moon } from "lucide-react";

/**
 * Dark ↔ light. Both themes are real (globals.css defines the full token set for each), so
 * this is a supported switch rather than a decoration — an organizer working next to a window
 * at 11:00 gets a readable screen, the room gets the dark one at 21:00.
 */
export default function ThemeToggle() {
  const t = useTranslations("nav");
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  // The server can't know the stored theme, so render a same-sized placeholder until mount
  // rather than guessing and flashing the wrong icon.
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="mds-tap h-9 w-9 rounded-sm border border-line bg-tint" aria-hidden />;
  }

  const isDark = resolvedTheme !== "light";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="mds-tap flex h-9 w-9 items-center justify-center rounded-sm border border-line bg-tint text-fg-muted transition-colors hover:border-line-hover hover:text-fg"
      aria-label={t("toggleTheme")}
      aria-pressed={!isDark}
      title={isDark ? t("switchToLight") : t("switchToDark")}
    >
      {isDark ? <Sun size={17} aria-hidden /> : <Moon size={17} aria-hidden />}
    </button>
  );
}
