const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Initializing LAN Stress Test Setup...");

  // 1. Create/Find Tournament
  const tournament = await prisma.tournament.upsert({
    where: { id: 'stress-test-tournament' },
    update: {},
    create: {
      id: 'stress-test-tournament',
      name: 'LAN Stress Test (CS2)',
      game: 'Counter-Strike 2',
      category: 'BRACKET',
      type: 'TOURNAMENT',
      format: 'DOUBLE_ELIMINATION',
      teamSize: 2
    }
  });

  // 2. Create Teams & Players with Seat Numbers
  const teamAlpha = await prisma.team.upsert({
    where: { id: 'team-alpha' },
    update: {},
    create: {
      id: 'team-alpha',
      name: 'Team Alpha',
      logoUrl: 'https://i.imgur.com/uRovCbe.png',
      tournamentId: tournament.id,
      players: {
        create: [
          { name: 'Leo', nickname: 'Leo', seating: 'A10' },
          { name: 'Sam', nickname: 'Sam', seating: 'A11' }
        ]
      }
    }
  });

  const teamBravo = await prisma.team.upsert({
    where: { id: 'team-bravo' },
    update: {},
    create: {
      id: 'team-bravo',
      name: 'Team Bravo',
      logoUrl: 'https://i.imgur.com/6U9Z8ZQ.png',
      tournamentId: tournament.id,
      players: {
        create: [
          { name: 'Chloe', nickname: 'Chloe', seating: 'B20' },
          { name: 'Toby', nickname: 'Toby', seating: 'B21' }
        ]
      }
    }
  });

  // 3. Create Match in READY state
  const match = await prisma.match.upsert({
    where: { id: 'match-1' },
    update: {
      status: 'LIVE',
      serverIp: '10.0.0.1',
      serverPort: '27015',
      serverPassword: '' // Empty for Test 1
    },
    create: {
      id: 'match-1',
      tournamentId: tournament.id,
      homeTeamId: teamAlpha.id,
      awayTeamId: teamBravo.id,
      round: 1,
      matchOrder: 1,
      status: 'READY',
      serverIp: '10.0.0.1',
      serverPort: '27015',
      serverPassword: '',
      bestOf: 1
    }
  });

  console.log("✅ Stress Test Environment Primed!");
  console.log(`Tournament: ${tournament.id}`);
  console.log(`Match: ${match.id}`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
