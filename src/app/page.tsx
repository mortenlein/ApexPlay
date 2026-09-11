import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";

// Picks the redirect target from the DB on every request; a prerendered page would bake in
// whichever tournament happened to be newest at build time.
export const dynamic = 'force-dynamic';

export default async function Home() {
  const latestTournament = await prisma.tournament.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  if (latestTournament) {
    redirect(`/tournaments/${latestTournament.id}`);
  }

  redirect("/dashboard");
}
