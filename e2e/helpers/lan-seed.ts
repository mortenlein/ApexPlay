import path from 'path';
import { PrismaClient } from '@prisma/client';

/**
 * Non-destructive seeding for the LAN-flow specs.
 *
 * `helpers/seed.ts` wipes the whole database (it builds one canonical fixture), which makes
 * tests order-dependent and — worse — invalidates every already-minted session token, because
 * `User` rows are recreated with fresh ids. These helpers only ever *add* a tournament, so each
 * test owns its own data and tests stay independent of one another.
 */
const defaultDatabaseUrl = `file:${path.resolve(process.cwd(), 'prisma', `e2e-${process.env.E2E_PORT || '4101'}.db`).replace(/\\/g, '/')}`;

export const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL || defaultDatabaseUrl } },
});

let counter = 0;
const uniqueName = (prefix: string) => `${prefix} ${Date.now().toString(36)}-${counter++}`;

export interface TournamentOptions {
  name?: string;
  teamSize?: number;
  format?: 'SINGLE_ELIMINATION' | 'DOUBLE_ELIMINATION';
  steamSignupEnabled?: boolean;
  rosterLocked?: boolean;
  bo3LastRounds?: number | null;
  hasThirdPlace?: boolean;
  eonBridgeToken?: string | null;
}

/** A brand-new, empty tournament. Nothing else in the database is touched. */
export async function createTournament(options: TournamentOptions = {}) {
  const format = options.format ?? 'SINGLE_ELIMINATION';
  return prisma.tournament.create({
    data: {
      name: options.name ?? uniqueName('LAN Cup'),
      game: 'CS2',
      category: 'BRACKET',
      type: format,
      format,
      teamSize: options.teamSize ?? 1,
      steamSignupEnabled: options.steamSignupEnabled ?? false,
      rosterLocked: options.rosterLocked ?? false,
      bo3LastRounds: options.bo3LastRounds ?? null,
      hasThirdPlace: options.hasThirdPlace ?? false,
      eonBridgeToken: options.eonBridgeToken ?? null,
    },
  });
}

export interface SeedPlayer {
  name: string;
  nickname?: string;
  seating?: string;
  steamId?: string;
  userId?: string;
  isLeader?: boolean;
}

/** One team in an existing tournament, with however many player rows are asked for. */
export async function createTeam(
  tournamentId: string,
  options: { name: string; seed?: number | null; inviteCode?: string; players?: SeedPlayer[] }
) {
  return prisma.team.create({
    data: {
      name: options.name,
      tournamentId,
      seed: options.seed ?? null,
      inviteCode: options.inviteCode ?? `inv-${Math.random().toString(36).slice(2, 10)}`,
      players: {
        create: (options.players ?? []).map((player) => ({
          name: player.name,
          nickname: player.nickname ?? null,
          seating: player.seating ?? null,
          steamId: player.steamId ?? null,
          userId: player.userId ?? null,
          isLeader: player.isLeader ?? false,
          tournamentId,
        })),
      },
    },
    include: { players: true },
  });
}

/**
 * `count` seeded teams (seed 1..count) each with a single placeholder player, named so the
 * bracket assertions can talk about "the seed-3 team" rather than an opaque uuid.
 */
export async function createSeededTeams(tournamentId: string, count: number) {
  const teams = [];
  for (let seed = 1; seed <= count; seed++) {
    teams.push(
      await createTeam(tournamentId, {
        name: `Seed ${seed}`,
        seed,
        players: [{ name: `Player ${seed}`, seating: `S${String(seed).padStart(2, '0')}`, isLeader: true }],
      })
    );
  }
  return teams;
}

/** Every match of a tournament, in bracket order (round, then matchOrder). */
export async function readMatches(tournamentId: string) {
  return prisma.match.findMany({
    where: { tournamentId },
    orderBy: [{ bracketType: 'asc' }, { round: 'asc' }, { matchOrder: 'asc' }],
  });
}

export async function readMatch(matchId: string) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new Error(`readMatch(${matchId}): no such match`);
  return match;
}

export async function setRosterLocked(tournamentId: string, rosterLocked: boolean) {
  return prisma.tournament.update({ where: { id: tournamentId }, data: { rosterLocked } });
}

export async function readPlayer(playerId: string) {
  return prisma.player.findUnique({ where: { id: playerId } });
}

/**
 * A callable two-team match: both rosters present (so `/load` will notify) and a server to
 * connect to, exactly like the fixture a marshal sees on the floor.
 */
export async function createCallableMatch(options: { homeUserId?: string; awayUserId?: string } = {}) {
  const tournament = await createTournament({ name: uniqueName('Floor Cup'), teamSize: 1 });
  const home = await createTeam(tournament.id, {
    name: 'Home Crew',
    seed: 1,
    players: [{ name: 'Home Player', nickname: 'Homie', seating: 'A12', userId: options.homeUserId, isLeader: true }],
  });
  const away = await createTeam(tournament.id, {
    name: 'Away Crew',
    seed: 2,
    players: [{ name: 'Away Player', nickname: 'Awayo', seating: 'C01', userId: options.awayUserId, isLeader: true }],
  });

  const match = await prisma.match.create({
    data: {
      tournamentId: tournament.id,
      homeTeamId: home.id,
      awayTeamId: away.id,
      round: 1,
      matchOrder: 0,
      bestOf: 1,
      scoreLimit: 1,
      status: 'PENDING',
      serverIp: '127.0.0.1',
      serverPort: '27015',
      bracketType: 'WINNERS',
    },
  });

  return { tournament, home, away, match };
}

// ---------------------------------------------------------------------------
// Public/spectator fixtures (used by the `public-*` specs)
//
// The public surfaces (tournament page, OBS overlay, roster board) only ever *read*, so what
// they need is a tournament that already looks like a LAN in progress: a generated bracket,
// a couple of played matches with real advancement, and one match on the floor right now.
// Generation and scoring go through the admin API rather than raw Prisma writes so the fixture
// is wired exactly the way the product wires it (nextMatchSlot, winnerId, loser drops).
// ---------------------------------------------------------------------------

/** Generate the bracket for `tournamentId` as the organizer, exactly as staff would. */
export async function generateBracketAsAdmin(tournamentId: string) {
  const { apiAs } = await import('./api');
  const api = await apiAs('marcus');
  const res = await api.post(`/api/tournaments/${tournamentId}/generate`, { data: {} });
  if (res.status() !== 200) {
    throw new Error(`generateBracketAsAdmin(${tournamentId}): ${res.status()} ${await res.text()}`);
  }
  return readMatches(tournamentId);
}

/** Report a final score for a match as the organizer (real advancement + SSE broadcast). */
export async function scoreMatchAsAdmin(matchId: string, homeScore: number, awayScore: number) {
  const { apiAs } = await import('./api');
  const api = await apiAs('marcus');
  const res = await api.post(`/api/matches/${matchId}`, { data: { homeScore, awayScore } });
  if (res.status() !== 200) {
    throw new Error(`scoreMatchAsAdmin(${matchId}): ${res.status()} ${await res.text()}`);
  }
  return res;
}

/** Put a match on the floor (status LIVE) without going through the call/load flow. */
export async function setMatchLive(matchId: string) {
  return prisma.match.update({ where: { id: matchId }, data: { status: 'LIVE' } });
}

export interface PlayedBracketOptions {
  name?: string;
  teams?: number;
  format?: 'SINGLE_ELIMINATION' | 'DOUBLE_ELIMINATION';
  /** How many round-1 matches to play out (home wins 1:0). */
  completed?: number;
  /** Mark the round-1 match right after the completed ones LIVE (default: yes). */
  live?: boolean;
}

/**
 * A tournament a spectator can actually look at: seeded teams, a generated bracket, the first
 * `completed` round-1 matches played (home side wins 1:0) and optionally the next one LIVE.
 */
export async function seedPlayedBracket(options: PlayedBracketOptions = {}) {
  const teamCount = options.teams ?? 8;
  const completed = options.completed ?? 2;
  const tournament = await createTournament({
    name: options.name ?? uniqueName(options.format === 'DOUBLE_ELIMINATION' ? 'DE Showcase' : 'SE Showcase'),
    teamSize: 1,
    format: options.format ?? 'SINGLE_ELIMINATION',
  });
  const teams = await createSeededTeams(tournament.id, teamCount);
  const generated = await generateBracketAsAdmin(tournament.id);

  const roundOne = generated
    .filter((m) => m.round === 1 && m.bracketType === 'WINNERS' && m.homeTeamId && m.awayTeamId)
    .sort((a, b) => a.matchOrder - b.matchOrder);

  const played = roundOne.slice(0, completed);
  for (const match of played) {
    await scoreMatchAsAdmin(match.id, 1, 0);
  }

  let liveMatch: Awaited<ReturnType<typeof setMatchLive>> | null = null;
  if (options.live !== false && roundOne.length > completed) {
    liveMatch = await setMatchLive(roundOne[completed].id);
  }

  return {
    tournament,
    tournamentId: tournament.id,
    teams,
    playedMatches: played,
    liveMatch,
    matches: await readMatches(tournament.id),
  };
}

/**
 * Plant recognisable secrets on a tournament's teams/players/matches so a leak test can grep
 * for a literal instead of trusting a field name. Returns every string that must never reach a
 * spectator's browser.
 */
export async function plantTeamSecrets(tournamentId: string) {
  const teams = await prisma.team.findMany({ where: { tournamentId }, include: { players: true } });
  const secrets: string[] = [];

  for (const [index, team] of teams.entries()) {
    const inviteCode = `LEAKCANARY-INVITE-${index}-${team.id.slice(0, 6)}`;
    await prisma.team.update({ where: { id: team.id }, data: { inviteCode } });
    secrets.push(inviteCode);

    for (const [playerIndex, player] of team.players.entries()) {
      const steamId = `7656119855500${index}${playerIndex}`;
      await prisma.player.update({ where: { id: player.id }, data: { steamId } });
      secrets.push(steamId);
    }
  }

  // Server credentials live on matches; staff see them, spectators must not.
  const serverPassword = `LEAKCANARY-SRVPASS-${tournamentId.slice(0, 6)}`;
  await prisma.match.updateMany({
    where: { tournamentId },
    data: { serverIp: '10.0.0.9', serverPort: '27099', serverPassword },
  });
  secrets.push(serverPassword);

  return secrets;
}

/** `count` teams, each with `perTeam` seated players — the roster board's real shape. */
export async function createRosterTeams(tournamentId: string, count: number, perTeam = 2) {
  const teams = [];
  for (let seed = 1; seed <= count; seed++) {
    teams.push(
      await createTeam(tournamentId, {
        name: `Roster Squad ${seed}`,
        seed,
        players: Array.from({ length: perTeam }, (_, i) => ({
          name: `Roster Player ${seed}-${i + 1}`,
          seating: `R${String(seed).padStart(2, '0')}-${i + 1}`,
          isLeader: i === 0,
        })),
      })
    );
  }
  return teams;
}
