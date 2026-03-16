import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";

export default async function Home() {
  const latestTournament = await prisma.tournament.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  if (latestTournament) {
    redirect(`/tournaments/${latestTournament.id}`);
  }

  redirect("/dashboard");
}
