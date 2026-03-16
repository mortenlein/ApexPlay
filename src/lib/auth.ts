import { cookies } from "next/headers";

const COOKIE_NAME = "apexplay_admin_auth";

export async function setAuthSession() {
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days
  (await cookies()).set(COOKIE_NAME, "authenticated", {
    expires,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

export async function clearAuthSession() {
  (await cookies()).delete(COOKIE_NAME);
}

export async function isAuthenticated() {
  const cookieStore = await cookies();
  return cookieStore.has(COOKIE_NAME);
}

export function verifyPassword(password: string) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.warn("ADMIN_PASSWORD is not set in environment variables");
    return false;
  }
  return password === adminPassword;
}
