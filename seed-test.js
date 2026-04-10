const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
  const t = await prisma.tournament.create({
    data: {
      name: 'CS2 Open (Steam Test)',
      game: 'CS2',
      category: 'BRACKET',
      type: 'SINGLE_ELIMINATION',
      format: 'SINGLE_ELIMINATION',
      teamSize: 5,
      steamSignupEnabled: true
    }
  });
  console.log('Tournament Created:', t.id);
}

seed().catch(console.error).finally(() => prisma.$disconnect());
