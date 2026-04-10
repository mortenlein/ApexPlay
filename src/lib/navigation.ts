export type NavMatchMode = "exact" | "prefix";

export type NavContext = "public" | "player" | "admin" | "marshal";

export interface NavItem {
  href: string;
  label: string;
  icon?: any;
  matchMode?: NavMatchMode;
  contexts?: NavContext[];
  mobileOnly?: boolean;
  desktopOnly?: boolean;
}

export interface TournamentTabConfig {
  id: string;
  label: string;
  icon: any;
}

export interface CommandAction {
  id: string;
  label: string;
  keywords?: string[];
  contexts: NavContext[];
  run: () => void | Promise<void>;
}

export function isActivePath(pathname: string, href: string, matchMode: NavMatchMode = "exact") {
  if (!pathname) {
    return false;
  }

  if (matchMode === "exact") {
    return pathname === href;
  }

  if (pathname === href) {
    return true;
  }

  return pathname.startsWith(`${href}/`);
}

export function deriveNavContext(pathname: string, isSignedIn: boolean) {
  if (pathname.startsWith("/admin")) {
    return "admin" as NavContext;
  }

  if (pathname.startsWith("/marshal")) {
    return "marshal" as NavContext;
  }

  if (isSignedIn || pathname.startsWith("/dashboard") || pathname.startsWith("/profile")) {
    return "player" as NavContext;
  }

  return "public" as NavContext;
}
