import prisma from "@/lib/prisma";
import { sendPushToUsers } from "@/lib/push";
import { announceMatch } from "@/lib/discord";

/**
 * Notify both teams in a match that it's ready / live across every channel:
 *  - web push to each registered player ("you're up — get to your station"),
 *  - an in-app NotificationLog entry (surfaced on the marshal board),
 *  - a Discord post via the existing announce path (real delivery when configured).
 *
 * Safe to call best-effort; never throws into the request path.
 */
export async function notifyMatchReady(matchId: string, status: string) {
  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        tournament: { select: { id: true, name: true, game: true } },
        homeTeam: { include: { players: { select: { userId: true } } } },
        awayTeam: { include: { players: { select: { userId: true } } } },
      },
    });
    if (!match || !match.homeTeam || !match.awayTeam) return;

    const userIds = [...(match.homeTeam.players || []), ...(match.awayTeam.players || [])]
      .map((p) => p.userId)
      .filter((id): id is string => Boolean(id));

    const title = `${match.homeTeam.name} vs ${match.awayTeam.name}`;
    const body =
      status === "LIVE"
        ? "You're live — get to your station."
        : "Your match is ready. Head to your station.";

    await sendPushToUsers(userIds, {
      title,
      body,
      url: `/tournaments/${match.tournamentId}`,
      tag: `match-${match.id}`,
    });

    await prisma.notificationLog
      .create({
        data: {
          type: "MATCH_READY",
          title,
          description: body,
          tournamentId: match.tournamentId,
        },
      })
      .catch(() => {});

    await announceMatch({
      homeTeam: match.homeTeam.name,
      awayTeam: match.awayTeam.name,
      round: match.round,
      tournamentName: match.tournament.name,
      tournamentId: match.tournamentId,
      matchUrl: `${process.env.NEXTAUTH_URL}/tournaments/${match.tournamentId}`,
      game: match.tournament.game,
    }).catch(() => {});
  } catch (err) {
    console.warn("[Notify] notifyMatchReady failed:", err);
  }
}
