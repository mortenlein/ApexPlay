import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { getAuthOptions } from "@/lib/auth";
import { isAdminSteamId, isStaffSteamId, getRoleForSteamId, type UserRole } from "@/lib/admin-config";

export async function getUserSession() {
  return (await getServerSession(getAuthOptions(undefined))) as any;
}

/** Resolved identity + role for the current request (admin / marshal / player). */
export async function getSessionIdentity(): Promise<{
  steamId?: string;
  name?: string;
  role: UserRole;
}> {
  const session = await getUserSession();
  const steamId = (session?.user as any)?.steamId as string | undefined;
  return {
    steamId,
    name: session?.user?.name as string | undefined,
    role: getRoleForSteamId(steamId),
  };
}

/**
 * Admin = a signed-in Steam user whose steamid64 is in the ADMIN_STEAMIDS allowlist.
 * There is no shared admin password; admins are seeded at deploy time via env.
 */
export async function isAdminAuthenticated() {
  const session = await getUserSession();
  return isAdminSteamId((session?.user as any)?.steamId);
}

/** Staff = admin or marshal (ADMIN_STEAMIDS ∪ MARSHAL_STEAMIDS). */
export async function isStaffAuthenticated() {
  const session = await getUserSession();
  return isStaffSteamId((session?.user as any)?.steamId);
}

export async function requireStaffApi() {
  if (await isStaffAuthenticated()) {
    return null;
  }
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function requireStaffPage(callbackUrl: string) {
  const session = await getUserSession();
  if (isStaffSteamId((session?.user as any)?.steamId)) {
    return;
  }
  if (session?.user) {
    redirect("/");
  }
  const safeCallbackUrl = callbackUrl.startsWith("/") ? callbackUrl : "/marshal/dashboard";
  redirect(`/login?callbackUrl=${encodeURIComponent(safeCallbackUrl)}`);
}

export async function requireAdminPage(callbackUrl: string) {
  const session = await getUserSession();
  if (isAdminSteamId((session?.user as any)?.steamId)) {
    return;
  }

  // Signed in but not an admin → send home (no point looping back to login).
  if (session?.user) {
    redirect("/");
  }

  const safeCallbackUrl = callbackUrl.startsWith("/") ? callbackUrl : "/admin";
  redirect(`/login?callbackUrl=${encodeURIComponent(safeCallbackUrl)}`);
}

export async function requireAdminApi() {
  if (await isAdminAuthenticated()) {
    return null;
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function requireSignedInUser() {
  const session = await getUserSession();
  if (session?.user) {
    return session;
  }

  return null;
}
