const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const t = await prisma.tournament.findFirst({
    where: { name: '128-Team Wingman Stress Test' },
    orderBy: { createdAt: 'desc' }
  });
  if (t) {
    console.log(t.id);
  } else {
    console.log('Tournament not found');
  }
}
run().finally(() => prisma.$disconnect());
