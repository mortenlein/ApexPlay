// Server-only data helpers (direct Prisma) used for SSR prefetch in server components.
// Client components must NOT import this — they use the fetch layer in `client-api.ts`.
//
// SECURITY: whatever these helpers return is serialized into the dehydrated React Query state
// that ships inside the rendered HTML, so an anonymous viewer can read it with view-source.
// They must therefore expose no more than the matching public API route does for the same
// viewer. The route handlers are the source of truth for the public shapes — keep the selects
// and the shaping functions below in sync with:
//   - src/app/api/tournaments/[id]/teams/route.ts      (`findTeams` + `toPublicTeam`)
//   - src/app/api/tournaments/[id]/matches/route.ts    (`select` + `toPublicTeam`)
//   - src/app/api/tournaments/[id]/route.ts            (GET: full tournament + `_count`)
//   - src/app/api/tournaments/[id]/scoreboard/route.ts (GET: entries + team)
// (The shaping is duplicated rather than imported because route files should only export
// route handlers.)
import prisma from './prisma';
import { getUserSession, isStaffAuthenticated } from './route-auth';
import { isStaffSteamId } from './admin-config';

/**
 * Resolve the viewer once: staff flag (full payload) + DB user id ("is this my team").
 * Mirrors how the teams route resolves the viewer.
 */
async function getViewer(): Promise<{ isStaff: boolean; userId?: string }> {
  const session = await getUserSession();
  return {
    isStaff: isStaffSteamId((session?.user as any)?.steamId),
    userId: (session?.user as any)?.id as string | undefined,
  };
}

// ---------------------------------------------------------------------------
// Tournament
// ---------------------------------------------------------------------------

/**
 * `eonBridgeToken` is a bearer credential for the EON webhook (see
 * src/app/api/webhooks/eon/route.ts) — never put it in a page payload for a non-staff viewer.
 */
function toPublicTournament<T extends { eonBridgeToken?: string | null }>(tournament: T) {
  const { eonBridgeToken: _eonBridgeToken, ...rest } = tournament;
  return rest;
}

export async function getTournament(id: string) {
  const { isStaff } = await getViewer();
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    // `_count` keeps this identical to GET /api/tournaments/[id], so the client refetch under
    // the same query key doesn't change shape mid-page.
    include: {
      _count: {
        select: { teams: true, matches: true },
      },
    },
  });

  if (!tournament) {
    return null;
  }

  return isStaff ? tournament : toPublicTournament(tournament);
}

// ---------------------------------------------------------------------------
// Teams  (mirrors src/app/api/tournaments/[id]/teams/route.ts)
// ---------------------------------------------------------------------------

const teamSelect = {
  id: true,
  name: true,
  logoUrl: true,
  inviteCode: true,
  seed: true,
  updatedAt: true,
  players: {
    select: {
      id: true,
      name: true,
      nickname: true,
      countryCode: true,
      seating: true,
      steamId: true,
      isLeader: true,
      userId: true,
      user: {
        select: {
          accounts: {
            select: {
              provider: true,
            },
          },
        },
      },
    },
  },
} as const;

type TeamRow = {
  id: string;
  name: string;
  logoUrl: string | null;
  inviteCode: string | null;
  seed: number | null;
  updatedAt: Date;
  players: {
    id: string;
    name: string;
    nickname: string | null;
    countryCode: string | null;
    seating: string | null;
    isLeader: boolean;
    userId: string | null;
  }[];
};

/**
 * Public roster shape: no Steam/user identifiers on any player, and no invite code unless the
 * viewer is on that team (the code is a join credential). Seats, names, nicknames, flags and
 * leader flags stay public — the roster/OBS pages are meant to show them.
 */
function toPublicTeam(team: TeamRow, viewerUserId?: string) {
  const players = team.players.map((player) => ({
    id: player.id,
    name: player.name,
    nickname: player.nickname,
    countryCode: player.countryCode,
    seating: player.seating,
    isLeader: player.isLeader,
    isMe: Boolean(viewerUserId && player.userId === viewerUserId),
  }));

  const isMyTeam = players.some((player) => player.isMe);

  return {
    id: team.id,
    name: team.name,
    logoUrl: team.logoUrl,
    seed: team.seed,
    updatedAt: team.updatedAt,
    ...(isMyTeam ? { inviteCode: team.inviteCode } : {}),
    players,
  };
}

export async function getTournamentWithTeams(id: string) {
  const { isStaff, userId } = await getViewer();
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: {
      teams: {
        select: teamSelect,
        orderBy: { seed: 'asc' },
      },
    },
  });

  if (!tournament) {
    return null;
  }

  if (isStaff) {
    return tournament;
  }

  const { teams, ...rest } = tournament;
  return {
    ...toPublicTournament(rest),
    teams: teams.map((team) => toPublicTeam(team, userId)),
  };
}

// ---------------------------------------------------------------------------
// Matches  (mirrors src/app/api/tournaments/[id]/matches/route.ts)
// ---------------------------------------------------------------------------

// Note the omissions, which apply to staff too because the route omits them for everyone:
// `serverIp` / `serverPort` / `serverPassword` (server credentials — the player queue endpoint
// hands those to the players of that match instead).
const matchSelect = {
  id: true,
  round: true,
  matchOrder: true,
  status: true,
  bracketType: true,
  bestOf: true,
  scoreLimit: true,
  homeScore: true,
  awayScore: true,
  updatedAt: true,
  winnerId: true,
  nextMatchId: true,
  loserNextMatchId: true,
  homeTeamId: true,
  awayTeamId: true,
  mapScores: true,
  homeTeam: {
    select: {
      id: true,
      name: true,
      logoUrl: true,
      seed: true,
      players: {
        select: { id: true, name: true, seating: true, steamId: true, isOnline: true },
      },
    },
  },
  awayTeam: {
    select: {
      id: true,
      name: true,
      logoUrl: true,
      seed: true,
      players: {
        select: { id: true, name: true, seating: true, steamId: true, isOnline: true },
      },
    },
  },
} as const;

type PublicMatchPlayer = { id: string; name: string; seating: string | null; isOnline: boolean };

/** Player steamIds are staff-only; seating and presence stay public for the bracket. */
function toPublicMatchTeam<T extends { players: (PublicMatchPlayer & { steamId: string | null })[] }>(
  team: T | null
) {
  if (!team) {
    return team;
  }

  return {
    ...team,
    players: team.players.map(({ id, name, seating, isOnline }): PublicMatchPlayer => ({
      id,
      name,
      seating,
      isOnline,
    })),
  };
}

export async function getMatches(tournamentId: string) {
  const isStaff = await isStaffAuthenticated();
  const matches = await prisma.match.findMany({
    where: { tournamentId },
    select: matchSelect,
    orderBy: [{ round: 'asc' }, { matchOrder: 'asc' }],
  });

  if (isStaff) {
    return matches;
  }

  return matches.map((match) => ({
    ...match,
    homeTeam: toPublicMatchTeam(match.homeTeam),
    awayTeam: toPublicMatchTeam(match.awayTeam),
  }));
}

// ---------------------------------------------------------------------------
// Scoreboard  (mirrors src/app/api/tournaments/[id]/scoreboard/route.ts)
// ---------------------------------------------------------------------------

export async function getScoreboard(tournamentId: string) {
  const { isStaff } = await getViewer();
  return await prisma.scoreboardEntry.findMany({
    where: { tournamentId },
    include: {
      team: isStaff
        ? true
        : {
            // The embedded team is display-only here; `inviteCode` is a join credential and has
            // no business being in a public page payload.
            select: {
              id: true,
              name: true,
              logoUrl: true,
              seed: true,
              tournamentId: true,
              updatedAt: true,
            },
          },
    },
    orderBy: {
      points: 'desc',
    },
  });
}
