import path from 'path';
import { PrismaClient } from '@prisma/client';

const defaultDatabaseUrl = `file:${path.resolve(process.cwd(), 'prisma', 'e2e.db').replace(/\\/g, '/')}`;

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || defaultDatabaseUrl,
    },
  },
});

export interface SeededScenario {
  matchId: string;
  tournamentId: string;
}

export interface SeededTournament {
  tournamentId: string;
}

export async function seedLanScenario(): Promise<SeededScenario> {
  await prisma.notificationLog.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.scoreboardEntry.deleteMany();
  await prisma.match.deleteMany();
  await prisma.player.deleteMany();
  await prisma.team.deleteMany();
  await prisma.tournament.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  const [leo, sam, chloe, toby] = await Promise.all([
    prisma.user.create({
      data: {
        email: 'mock+leo@apexplay.local',
        name: 'Leo',
        steamId: '76561198000000002',
      },
    }),
    prisma.user.create({
      data: {
        email: 'mock+sam@apexplay.local',
        name: 'Sam',
        steamId: '76561198000000003',
      },
    }),
    prisma.user.create({
      data: {
        email: 'mock+chloe@apexplay.local',
        name: 'Chloe',
        steamId: '76561198000000004',
      },
    }),
    prisma.user.create({
      data: {
        email: 'mock+toby@apexplay.local',
        name: 'Toby',
        steamId: '76561198000000005',
      },
    }),
  ]);

  const tournament = await prisma.tournament.create({
    data: {
      name: 'LAN Finals',
      game: 'CS2',
      category: 'BRACKET',
      type: 'SINGLE_ELIMINATION',
      format: 'SINGLE_ELIMINATION',
      teamSize: 2,
      steamSignupEnabled: true,
    },
  });

  const teamA = await prisma.team.create({
    data: {
      name: 'Team A',
      tournamentId: tournament.id,
      seed: 1,
      inviteCode: 'TEAMA123',
      players: {
        create: [
          {
            name: 'Leo',
            nickname: 'Leo',
            seating: 'A12',
            steamId: leo.steamId,
            userId: leo.id,
            tournamentId: tournament.id,
            isLeader: true,
          },
          {
            name: 'Sam',
            nickname: 'Sam',
            seating: 'A13',
            steamId: sam.steamId,
            userId: sam.id,
            tournamentId: tournament.id,
          },
        ],
      },
    },
  });

  const teamB = await prisma.team.create({
    data: {
      name: 'Team B',
      tournamentId: tournament.id,
      seed: 2,
      inviteCode: 'TEAMB123',
      players: {
        create: [
          {
            name: 'Chloe',
            nickname: 'Chloe',
            seating: 'C01',
            steamId: chloe.steamId,
            userId: chloe.id,
            tournamentId: tournament.id,
            isLeader: true,
          },
          {
            name: 'Toby',
            nickname: 'Toby',
            seating: 'C02',
            steamId: toby.steamId,
            userId: toby.id,
            tournamentId: tournament.id,
          },
        ],
      },
    },
  });

  const match = await prisma.match.create({
    data: {
      tournamentId: tournament.id,
      homeTeamId: teamA.id,
      awayTeamId: teamB.id,
      round: 1,
      matchOrder: 0,
      bestOf: 1,
      scoreLimit: 1,
      status: 'READY',
      serverIp: '127.0.0.1',
      serverPort: '27015',
      serverPassword: null,
      bracketType: 'WINNERS',
    },
  });

  return {
    tournamentId: tournament.id,
    matchId: match.id,
  };
}

export async function seedEmptyTournament(): Promise<SeededTournament> {
  await prisma.notificationLog.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.scoreboardEntry.deleteMany();
  await prisma.match.deleteMany();
  await prisma.player.deleteMany();
  await prisma.team.deleteMany();
  await prisma.tournament.deleteMany();

  const tournament = await prisma.tournament.create({
    data: {
      name: 'Import Test Cup',
      game: 'CS2',
      category: 'BRACKET',
      type: 'SINGLE_ELIMINATION',
      format: 'SINGLE_ELIMINATION',
      teamSize: 2,
      steamSignupEnabled: false,
    },
  });

  return { tournamentId: tournament.id };
}
