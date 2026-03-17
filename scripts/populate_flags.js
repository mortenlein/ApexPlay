const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🏁 Starting flag population...');

    // Assign 'no' (Norway) to all players for now, as requested for the stress test tournament
    const result = await prisma.player.updateMany({
        data: {
            countryCode: 'no'
        }
    });

    console.log(`✅ Updated ${result.count} players with 'no' flag.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
