import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSignedInUser } from "@/lib/route-auth";

/** Save (or refresh) the caller's push subscription. */
export async function POST(request: Request) {
  const session = await requireSignedInUser();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const endpoint: string | undefined = body?.endpoint;
  const p256dh: string | undefined = body?.keys?.p256dh;
  const auth: string | undefined = body?.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId: session.user.id, p256dh, auth },
    create: { endpoint, p256dh, auth, userId: session.user.id },
  });

  return NextResponse.json({ success: true });
}
