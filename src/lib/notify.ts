import prisma from "@/lib/prisma";
import { groupUsersByLocale, isPushConfigured, sendPushBatches, type PushBatch } from "@/lib/push";
import { announceMatch } from "@/lib/discord";
import { getServerTranslations } from "@/i18n/server";

/** What a match-ready push needs to say who is playing whom, and where to send the tap. */
export interface MatchReadyCopy {
  homeTeam: string;
  awayTeam: string;
  status: string;
  tournamentId: string;
  matchId: string;
}

/**
 * The push, composed once per language present among the recipients.
 *
 * This is the payload a 12-year-old sees on a lock screen ten metres from their station, so it is
 * the one string in the app that most has to be in their own language. The recipients are grouped
 * by `User.locale` first and the copy is written per group — one payload for everybody would mean
 * whoever is in the minority gets told to go to their station in a language they may not read.
 *
 * Exported so the behaviour is testable without a phone in the loop: the payload set is the whole
 * observable contract of the push, and the delivery below is just a loop over it.
 */
export async function buildMatchReadyPushBatches(
  userIds: string[],
  copy: MatchReadyCopy
): Promise<PushBatch[]> {
  const audiences = await groupUsersByLocale(userIds);

  return Promise.all(
    audiences.map(async ({ locale, userIds: recipients }) => {
      const t = await getServerTranslations(locale, "notifications");
      const key = copy.status === "LIVE" ? "push.matchLive" : "push.matchReady";
      return {
        locale,
        userIds: recipients,
        payload: {
          title: t(`${key}.title`),
          body: t(`${key}.body`, { home: copy.homeTeam, away: copy.awayTeam }),
          url: `/tournaments/${copy.tournamentId}`,
          tag: `match-${copy.matchId}`,
        },
      };
    })
  );
}

/**
 * Notify both teams in a match that it's ready / live across every channel:
 *  - web push to each registered player, in that player's own language ("du er neste — gå til
 *    plassen din" / "you're up — get to your station"),
 *  - an in-app NotificationLog entry (written by the Discord announce path, surfaced on the marshal board),
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

    // Nothing to compose when push is switched off (no VAPID keys) — the language lookup and one
    // translator per language would otherwise run on every match call for a payload nobody sends.
    if (userIds.length > 0 && isPushConfigured()) {
      const batches = await buildMatchReadyPushBatches(userIds, {
        homeTeam: match.homeTeam.name,
        awayTeam: match.awayTeam.name,
        status,
        tournamentId: match.tournamentId,
        matchId: match.id,
      });
      await sendPushBatches(batches);
    }

    // The in-app NotificationLog row is written by announceMatch() (discord.ts logs on both the
    // real and mock delivery paths), so nothing is logged here — that would double the feed.

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
