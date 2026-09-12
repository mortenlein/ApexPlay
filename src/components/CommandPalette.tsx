"use client";

import React from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Command, Search, X } from "lucide-react";
import { deriveNavContext, CommandAction } from "@/lib/navigation";

const OPEN_EVENT = "apexplay:open-command-palette";

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function openCommandPalette() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

export default function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isMetaK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      const isSlash = event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey;

      if (isMetaK || (isSlash && !isTypingTarget(event.target))) {
        event.preventDefault();
        setOpen(true);
      }

      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    const onOpen = () => setOpen(true);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_EVENT, onOpen);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setSelectedIndex(0);
    }
  }, [open]);

  const context = deriveNavContext(pathname, status === "authenticated");

  // Staff-only destinations are gated on the session role, not just the surface: middleware
  // bounces a plain player out of /admin and /marshal, so offering them here is a dead end.
  const role = (session?.user as { role?: string } | undefined)?.role;
  const isAdmin = role === "admin";
  const isStaff = isAdmin || role === "marshal";

  const tournamentId = React.useMemo(() => {
    const publicMatch = pathname.match(/^\/tournaments\/([^/]+)/);
    if (publicMatch) {
      return publicMatch[1];
    }

    const adminMatch = pathname.match(/^\/admin\/tournaments\/([^/]+)/);
    return adminMatch ? adminMatch[1] : null;
  }, [pathname]);

  const commands = React.useMemo<CommandAction[]>(() => {
    const base: CommandAction[] = [
      {
        id: "go-tournaments",
        label: "Go to Tournaments",
        keywords: ["directory", "events", "public"],
        contexts: ["public", "player", "admin", "marshal"],
        run: () => router.push("/tournaments"),
      },
      {
        id: "go-dashboard",
        label: "Go to Dashboard",
        keywords: ["player", "matches"],
        contexts: ["public", "player", "admin", "marshal"],
        run: () => router.push("/dashboard"),
      },
      {
        id: "go-profile",
        label: "Open Profile",
        keywords: ["account", "user"],
        contexts: ["public", "player", "admin", "marshal"],
        run: () => router.push("/profile"),
      },
    ];

    if (isAdmin) {
      base.push({
        id: "go-admin",
        label: context === "admin" ? "Admin Overview" : "Open Admin Workspace",
        keywords: ["control", "workspace", "manage"],
        contexts: ["admin", "marshal", "player", "public"],
        run: () => router.push("/admin"),
      });
    }

    if (isStaff) {
      base.push({
        id: "go-marshal",
        label: "Open Marshal Board",
        keywords: ["seats", "floor", "readiness"],
        contexts: ["admin", "marshal", "player"],
        run: () => router.push("/marshal/dashboard"),
      });
    }

    if (tournamentId && pathname.startsWith("/tournaments/")) {
      base.push({
        id: "copy-tournament-link",
        label: "Copy Tournament Link",
        keywords: ["share", "url", "clipboard"],
        contexts: ["public", "player", "admin", "marshal"],
        run: async () => {
          await navigator.clipboard.writeText(window.location.href);
        },
      });
    }

    if (tournamentId && pathname.startsWith("/admin/tournaments/")) {
      base.push({
        id: "open-public-tournament",
        label: "Open Public Tournament Page",
        keywords: ["public", "view", "page"],
        contexts: ["admin", "marshal"],
        run: () => { window.open(`/tournaments/${tournamentId}`, "_blank", "noopener,noreferrer"); },
      });
      base.push({
        id: "start-match",
        label: "Start Match Workflow",
        keywords: ["admin", "matches", "load"],
        contexts: ["admin", "marshal"],
        run: () => router.push(`/admin/tournaments/${tournamentId}?tab=matches`),
      });
      base.push({
        id: "create-team",
        label: "Create Team",
        keywords: ["participants", "add", "roster"],
        contexts: ["admin"],
        run: () => router.push(`/admin/tournaments/${tournamentId}?tab=participants`),
      });
      base.push({
        id: "open-settings",
        label: "Open Tournament Settings",
        keywords: ["config", "admin"],
        contexts: ["admin"],
        run: () => router.push(`/admin/tournaments/${tournamentId}?tab=settings`),
      });
    }

    if (tournamentId && pathname.startsWith("/tournaments/")) {
      base.push({
        id: "go-tournament-matches",
        label: "Go to Tournament Matches",
        keywords: ["tab", "matches"],
        contexts: ["public", "player", "admin", "marshal"],
        run: () => router.push(`/tournaments/${tournamentId}?tab=matches`),
      });
    }

    return base;
  }, [context, isAdmin, isStaff, pathname, router, tournamentId]);

  const filtered = React.useMemo(() => {
    const visible = commands.filter((command) => command.contexts.includes(context));
    const term = query.trim().toLowerCase();

    if (!term) {
      return visible;
    }

    const parts = term.split(/\s+/).filter(Boolean);

    return visible.filter((command) => {
      const haystack = `${command.label} ${(command.keywords || []).join(" ")}`.toLowerCase();
      return parts.every((part) => haystack.includes(part));
    });
  }, [commands, context, query]);

  React.useEffect(() => {
    if (selectedIndex >= filtered.length) {
      setSelectedIndex(0);
    }
  }, [filtered.length, selectedIndex]);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((prev) => (filtered.length === 0 ? 0 : (prev + 1) % filtered.length));
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((prev) => (filtered.length === 0 ? 0 : (prev - 1 + filtered.length) % filtered.length));
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const selected = filtered[selectedIndex];
        if (selected) {
          void selected.run();
          setOpen(false);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [filtered, open, selectedIndex]);

  // --- Modal behaviour: trap Tab inside the dialog, lock the page behind it, and give the
  // caller's focus back when it closes. Without this, tabbing out of the palette lands on the
  // page underneath while the overlay still covers it. ---
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const returnFocusRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!open) {
      returnFocusRef.current?.focus?.();
      returnFocusRef.current = null;
      return;
    }

    returnFocusRef.current = document.activeElement as HTMLElement | null;

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const onTab = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);

      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onTab);
    return () => {
      document.removeEventListener("keydown", onTab);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div
      data-testid="command-palette-overlay"
      className="fixed inset-0 z-[300] flex items-start justify-center bg-scrim p-4 pt-[12vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        data-testid="command-palette"
        className="flex w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-line-hover bg-card shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <Search size={16} aria-hidden className="text-fg-subtle" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search commands…"
            aria-label="Search commands"
            role="combobox"
            aria-expanded
            aria-controls="command-palette-list"
            aria-activedescendant={filtered[selectedIndex] ? `command-option-${filtered[selectedIndex].id}` : undefined}
            data-testid="command-palette-input"
            className="h-10 flex-1 bg-transparent text-body text-fg outline-none placeholder:text-fg-subtle"
          />
          <kbd className="mds-numeric hidden rounded-sm border border-line px-1.5 py-0.5 text-label text-fg-subtle sm:block">
            ESC
          </kbd>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mds-tap flex h-8 w-8 items-center justify-center rounded-sm border border-line text-fg-muted transition-colors hover:bg-tint hover:text-fg"
            aria-label="Close command palette"
          >
            <X size={14} aria-hidden />
          </button>
        </div>

        <div id="command-palette-list" role="listbox" aria-label="Commands" className="max-h-[50vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-body text-fg-muted">No matching command.</div>
          ) : (
            filtered.map((command, index) => (
              <button
                type="button"
                key={command.id}
                id={`command-option-${command.id}`}
                role="option"
                aria-selected={index === selectedIndex}
                data-testid={`command-palette-item-${command.id}`}
                className={`mds-tap flex w-full items-center justify-between rounded-sm px-3 py-3 text-left text-body transition-colors ${
                  index === selectedIndex ? "bg-brand-soft text-brand" : "text-fg hover:bg-tint"
                }`}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => {
                  void command.run();
                  setOpen(false);
                }}
              >
                <span>{command.label}</span>
                {index === selectedIndex ? <Command size={14} aria-hidden /> : null}
              </button>
            ))
          )}
        </div>

        <p className="border-t border-line px-4 py-2 text-label uppercase tracking-[0.1em] text-fg-subtle">
          ↑↓ to move · ↵ to run · esc to close
        </p>
      </div>
    </div>
  );
}
