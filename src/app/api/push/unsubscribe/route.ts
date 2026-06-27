import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSignedInUser } from "@/lib/route-auth";

/** Remove the caller's push subscription for a given endpoint. */
export async function POST(request: Request) {
  const session = await requireSignedInUser();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const endpoint: string | undefined = body?.endpoint;
  if (!endpoint) {
    return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
  }

  await prisma.pushSubscription
    .deleteMany({ where: { endpoint, userId: session.user.id } })
    .catch(() => {});

  return NextResponse.json({ success: true });
}
