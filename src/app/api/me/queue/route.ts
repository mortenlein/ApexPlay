import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireSignedInUser } from '@/lib/route-auth';
import { isActive, isDone } from '@/lib/match-status';

// Auth + DB per request; never prerender at build time.
export const dynamic = 'force-dynamic';

/**
 * GET /api/me/queue
 *
 * For the signed-in player: per tournament they're registered in, their next match and how
 * many matches are scheduled ahead of it.
 *
 * "matchesAhead" = your place in the queue. A match counts as ahead of you only if it is
 *   (a) not done,
 *   (b) ordered before your next match in play order (round, then matchOrder), and
 *   (c) actually playable — both teams assigned — or already called/live.
 * (c) is what keeps the number honest: a freshly generated bracket is full of later-round
 * slots with no teams in them yet, and counting those made a round-1 player look like they
 * had a dozen matches to wait through.
 *
 * 0 + called/live = you're on now; 0 + pending = you're up next.
 */
export async function GET() {
  const session = await requireSignedInUser();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const players = await prisma.player.findMany({
    where: { userId: session.user.id },
    select: { teamId: true, tournamentId: true, team: { select: { name: true } } },
  });
  if (players.length === 0) {
    return NextResponse.json({ queue: [] });
  }

  // One team per tournament (enforced by the unique [tournamentId, userId] constraint).
  const byTournament = new Map<string, { teamId: string; teamName: string }>();
  for (const p of players) {
    byTournament.set(p.tournamentId, { teamId: p.teamId, teamName: p.team?.name ?? 'Your team' });
  }
  const tournamentIds = [...byTournament.keys()];

  const tournaments = await prisma.tournament.findMany({
    where: { id: { in: tournamentIds } },
    select: { id: true, name: true, game: true },
  });
  const tournamentById = new Map(tournaments.map((t) => [t.id, t]));

  const queue = await Promise.all(
    tournamentIds.map(async (tid) => {
      const { teamId, teamName } = byTournament.get(tid)!;
      const tournament = tournamentById.get(tid);
      const base = {
        tournamentId: tid,
        tournamentName: tournament?.name ?? 'Tournament',
        game: tournament?.game ?? 'CS2',
        teamName,
      };

      const matches = await prisma.match.findMany({
        where: { tournamentId: tid },
        orderBy: [{ round: 'asc' }, { matchOrder: 'asc' }],
        include: {
          homeTeam: { select: { name: true } },
          awayTeam: { select: { name: true } },
        },
      });

      if (matches.length === 0) {
        return { ...base, state: 'NO_BRACKET' as const, nextMatch: null, matchesAhead: null, totalPending: 0 };
      }

      const pending = matches.filter((m) => !isDone((m.status || '').toUpperCase()));
      const idx = pending.findIndex((m) => m.homeTeamId === teamId || m.awayTeamId === teamId);

      if (idx === -1) {
        const everPlayed = matches.some((m) => m.homeTeamId === teamId || m.awayTeamId === teamId);
        return {
          ...base,
          state: everPlayed ? ('OUT' as const) : ('AWAITING_DRAW' as const),
          nextMatch: null,
          matchesAhead: null,
          totalPending: pending.length,
        };
      }

      const m = pending[idx];
      const opponent = m.homeTeamId === teamId ? m.awayTeam?.name : m.homeTeam?.name;
      const youAreHome = m.homeTeamId === teamId;
      // See the rule in the route doc comment: only real, playable matches ordered before
      // yours count — plus anything already called/live even if a team slot is still empty.
      const matchesAhead = pending
        .slice(0, idx)
        .filter(
          (q) => (Boolean(q.homeTeamId) && Boolean(q.awayTeamId)) || isActive((q.status || '').toUpperCase())
        ).length;
      return {
        ...base,
        state: 'SCHEDULED' as const,
        matchesAhead,
        totalPending: pending.length,
        nextMatch: {
          id: m.id,
          round: m.round,
          status: m.status,
          bracketType: m.bracketType,
          bestOf: m.bestOf,
          opponent: opponent || 'TBD',
          youAreHome,
          hasOpponent: Boolean(opponent),
        },
      };
    })
  );

  return NextResponse.json({ queue });
}
