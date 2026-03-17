const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const esportsNicknames = [
    "Clutch", "Ace", "Phantom", "Viper", "Ghost", "Flash", "Blade", "Titan", 
    "Rogue", "Shadow", "Nova", "Zenith", "Apex", "Storm", "Zero", "Havoc",
    "Neon", "Bolt", "Cipher", "Slayer", "Wraith", "Omen", "Sage", "Jett",
    "Raze", "Breach", "Skye", "Kayo", "Killjoy", "Cypher", "Sova", "Phoenix"
];

async function main() {
    console.log("Fetching players for tournament teams...");
    
    // Get all players that don't have a nickname yet
    const players = await prisma.player.findMany();
    
    console.log(`Processing ${players.length} players...`);
    
    for (const player of players) {
        const randomNickname = esportsNicknames[Math.floor(Math.random() * esportsNicknames.length)];
        await prisma.player.update({
            where: { id: player.id },
            data: { nickname: randomNickname }
        });
    }
    
    console.log(`Successfully updated ${players.length} player nicknames.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
