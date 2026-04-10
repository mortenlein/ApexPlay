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
  const { status } = useSession();
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
      {
        id: "go-admin",
        label: context === "admin" ? "Admin Overview" : "Open Admin Workspace",
        keywords: ["control", "workspace", "manage"],
        contexts: ["admin", "marshal", "player", "public"],
        run: () => router.push(context === "admin" ? "/admin" : "/login?callbackUrl=/admin"),
      },
      {
        id: "go-marshal",
        label: "Open Marshal Board",
        keywords: ["seats", "floor", "readiness"],
        contexts: ["admin", "marshal", "player"],
        run: () => router.push("/marshal/dashboard"),
      },
    ];

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
        run: () => window.open(`/tournaments/${tournamentId}`, "_blank", "noopener,noreferrer"),
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
  }, [context, pathname, router, tournamentId]);

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

  if (!open) {
    return null;
  }

  return (
    <div data-testid="command-palette-overlay" className="fixed inset-0 z-[300] flex items-start justify-center bg-black/50 p-4 pt-[12vh] backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div data-testid="command-palette" className="w-full max-w-2xl overflow-hidden rounded-xl border border-[var(--mds-border)] bg-[var(--mds-card)] shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-[var(--mds-border)] px-4 py-3">
          <Search size={16} className="text-[var(--mds-text-subtle)]" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search commands..."
            data-testid="command-palette-input"
            className="h-10 flex-1 bg-transparent text-sm text-[var(--mds-text-primary)] outline-none placeholder:text-[var(--mds-text-subtle)]"
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded border border-[var(--mds-border)] text-[var(--mds-text-muted)] hover:text-[var(--mds-text-primary)]"
            aria-label="Close command palette"
          >
            <X size={14} />
          </button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-[var(--mds-text-muted)]">No matching command.</div>
          ) : (
            filtered.map((command, index) => (
              <button
                type="button"
                key={command.id}
                data-testid={`command-palette-item-${command.id}`}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm transition ${index === selectedIndex ? "bg-[var(--mds-action-soft)] text-[var(--mds-action)]" : "text-[var(--mds-text-primary)] hover:bg-[var(--mds-input)]"}`}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => {
                  void command.run();
                  setOpen(false);
                }}
              >
                <span>{command.label}</span>
                {index === selectedIndex ? <Command size={14} /> : null}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
