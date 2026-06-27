import { NextResponse } from "next/server";

/** Exposes the VAPID public key the browser needs to create a push subscription. */
export async function GET() {
  return NextResponse.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null });
}
