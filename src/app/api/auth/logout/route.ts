import { NextResponse } from "next/server";
import { deleteAuthSession } from "@/lib/auth";

const NEXT_AUTH_COOKIE_NAMES = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
  "next-auth.callback-url",
  "__Secure-next-auth.callback-url",
  "next-auth.csrf-token",
  "__Host-next-auth.csrf-token",
];

export async function POST() {
  await deleteAuthSession();
  const response = NextResponse.json({ success: true });

  for (const cookieName of NEXT_AUTH_COOKIE_NAMES) {
    response.cookies.delete(cookieName);
  }

  return response;
}
