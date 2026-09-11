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

/* ------------------------------------------------------------------------------------------- *
 * Inbound-integration fixtures (EON bridge, CS2 plugin, Discord mock, audit trail).
 * ------------------------------------------------------------------------------------------- */

let steamCounter = 0;
/** A fresh, collision-free steamid64-shaped id — the EON webhook matches rosters on these. */
export function nextSteamId(): string {
  steamCounter += 1;
  return `7656119${String(Date.now() % 1_000_000).padStart(6, '0')}${String(steamCounter).padStart(4, '0')}`;
}

/** A bridge token shaped like the one `POST /api/tournaments/{id}/eon-bridge` mints. */
export function fakeBridgeToken(): string {
  return `eon_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

export interface BridgedMatchOptions {
  /** Series length of the seeded match (1 = BO1, so the headline score is rounds). */
  bestOf?: number;
  /** Players per side; the EON frame carries exactly these steamids. */
  rosterSize?: number;
  /** Pre-minted bridge token; pass null for a tournament whose bridge is switched off. */
  token?: string | null;
  status?: string;
  homeName?: string;
  awayName?: string;
}

/**
 * A tournament with an enabled EON bridge and one live-able match whose two rosters carry
 * steamIds — the fixture the EON webhook is designed for: it identifies the match, and which
 * ApexPlay team is currently CT, purely from the steamids seen on the game server.
 */
export async function createBridgedMatch(options: BridgedMatchOptions = {}) {
  const rosterSize = options.rosterSize ?? 2;
  const token = options.token === undefined ? fakeBridgeToken() : options.token;
  const tournament = await createTournament({
    name: uniqueName('EON Cup'),
    teamSize: rosterSize,
    eonBridgeToken: token,
  });

  const homeSteamIds = Array.from({ length: rosterSize }, () => nextSteamId());
  const awaySteamIds = Array.from({ length: rosterSize }, () => nextSteamId());

  const home = await createTeam(tournament.id, {
    name: options.homeName ?? 'Home Crew',
    seed: 1,
    players: homeSteamIds.map((steamId, i) => ({
      name: `Home ${i + 1}`,
      steamId,
      seating: `A0${i + 1}`,
      isLeader: i === 0,
    })),
  });
  const away = await createTeam(tournament.id, {
    name: options.awayName ?? 'Away Crew',
    seed: 2,
    players: awaySteamIds.map((steamId, i) => ({
      name: `Away ${i + 1}`,
      steamId,
      seating: `B0${i + 1}`,
      isLeader: i === 0,
    })),
  });

  const bestOf = options.bestOf ?? 1;
  const match = await prisma.match.create({
    data: {
      tournamentId: tournament.id,
      homeTeamId: home.id,
      awayTeamId: away.id,
      round: 1,
      matchOrder: 0,
      bestOf,
      scoreLimit: Math.floor(bestOf / 2) + 1,
      status: options.status ?? 'PENDING',
      serverIp: '10.0.0.5',
      serverPort: '27015',
      serverPassword: 'lan-secret',
      bracketType: 'WINNERS',
    },
  });

  return { tournament, token, home, away, match, homeSteamIds, awaySteamIds };
}

/** A second match in an existing tournament, so "which match is this frame about?" is testable. */
export async function addMatch(
  tournamentId: string,
  options: { homeTeamId: string; awayTeamId: string; matchOrder?: number; status?: string; bestOf?: number }
) {
  return prisma.match.create({
    data: {
      tournamentId,
      homeTeamId: options.homeTeamId,
      awayTeamId: options.awayTeamId,
      round: 1,
      matchOrder: options.matchOrder ?? 1,
      bestOf: options.bestOf ?? 1,
      scoreLimit: 1,
      status: options.status ?? 'PENDING',
      bracketType: 'WINNERS',
    },
  });
}

export async function readTournament(tournamentId: string) {
  return prisma.tournament.findUnique({ where: { id: tournamentId } });
}

export async function readTeam(teamId: string) {
  return prisma.team.findUnique({ where: { id: teamId } });
}

/** The in-app announcement feed rows for a tournament (what the Discord mock path writes). */
export async function readNotifications(tournamentId: string) {
  return prisma.notificationLog.findMany({ where: { tournamentId }, orderBy: { createdAt: 'asc' } });
}

/** The audit trail rows for a tournament, oldest first. */
export async function readAuditRows(tournamentId: string) {
  return prisma.auditLog.findMany({ where: { tournamentId }, orderBy: { createdAt: 'asc' } });
}
