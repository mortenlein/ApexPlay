import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { getAuthOptions } from "@/lib/auth";
import { ADMIN_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/admin-session";

export async function getUserSession() {
  return (await getServerSession(getAuthOptions(undefined))) as any;
}

export async function isAdminAuthenticated() {
  const adminCookie = cookies().get(ADMIN_COOKIE_NAME)?.value;
  return verifyAdminSessionToken(adminCookie);
}

export async function requireAdminPage(callbackUrl: string) {
  if (await isAdminAuthenticated()) {
    return;
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
