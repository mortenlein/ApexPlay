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

// --- Organizer-UI helpers (appended for the e2e/organizer-*.spec.ts suites) -------------------
// Those specs drive the organizer's browser and then read the stored truth back, so what they
// need here are plain row readers rather than more fixtures.

/** The stored tournament row — the truth the settings UI claims it saved. */
export async function readTournament(id: string) {
  const tournament = await prisma.tournament.findUnique({ where: { id } });
  if (!tournament) throw new Error(`readTournament(${id}): no such tournament`);
  return tournament;
}

/** A tournament created through the UI, looked up by the name the test typed (null until saved). */
export async function findTournamentByName(name: string) {
  return prisma.tournament.findFirst({ where: { name } });
}

/**
 * Every team of a tournament with its roster attached, teams in seed order and players by name
 * (`Player` has no creation stamp, so name is the only stable ordering to assert against).
 */
export async function readTeams(tournamentId: string) {
  return prisma.team.findMany({
    where: { tournamentId },
    orderBy: { seed: 'asc' },
    include: { players: { orderBy: { name: 'asc' } } },
  });
}

/** One team with its roster (players by name), or null once the organizer has removed it. */
export async function readTeam(teamId: string) {
  return prisma.team.findUnique({
    where: { id: teamId },
    include: { players: { orderBy: { name: 'asc' } } },
  });
}
