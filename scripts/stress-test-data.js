const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

async function main() {
  console.log('--- Starting Massive Data Build ---');

  const tournamentId = uuidv4();
  const tournamentName = '128-Team Wingman Stress Test';

  console.log(`Creating Tournament: ${tournamentName}`);
  await prisma.tournament.create({
    data: {
      id: tournamentId,
      name: tournamentName,
      game: 'CS2',
      category: 'BRACKET',
      type: 'BRACKET', // Added missing field
      format: 'SINGLE_ELIMINATION',
      teamSize: 2,
    },
  });

  const teams = [];
  const players = [];
  const stats = [];

  console.log('Generating 128 Teams and 256 Players...');
  for (let i = 1; i <= 128; i++) {
    const teamId = uuidv4();
    const teamName = `Team ${i}`;
    teams.push({
      id: teamId,
      name: teamName,
      tournamentId,
      seed: i,
    });

    for (let p = 1; p <= 2; p++) {
      const playerId = uuidv4();
      const playerName = `Player ${i}-${p}`;
      players.push({
        id: playerId,
        name: playerName,
        teamId,
      });

      // Randomized Stats for JSON report
      stats.push({
        team: teamName,
        player: playerName,
        kills: Math.floor(Math.random() * 30),
        deaths: Math.floor(Math.random() * 20),
        adr: parseFloat((Math.random() * 150).toFixed(1)),
        kd: parseFloat((Math.random() * 3).toFixed(2)),
      });
    }
  }

  // Batch insert teams and players
  await prisma.team.createMany({ data: teams });
  await prisma.player.createMany({ data: players });

  console.log('Populating Bracket Tree...');
  // Total 7 rounds for 128 teams
  // Round 1: 64 matches, Round 2: 32, ..., Round 7: 1
  const rounds = 7;
  const matchIdsByRound = [];

  // Generate IDs for all matches first to link nextMatchId easier
  for (let r = 1; r <= rounds; r++) {
    const numMatches = Math.pow(2, rounds - r);
    const roundMatchIds = [];
    for (let m = 0; m < numMatches; m++) {
      roundMatchIds.push(uuidv4());
    }
    matchIdsByRound.push(roundMatchIds);
  }

  const matchesOutput = [];

  for (let r = 1; r <= rounds; r++) {
    const numMatches = Math.pow(2, rounds - r);
    console.log(`  Round ${r}: ${numMatches} matches`);
    
    for (let m = 0; m < numMatches; m++) {
      const matchId = matchIdsByRound[r-1][m];
      const nextMatchId = r < rounds ? matchIdsByRound[r][Math.floor(m / 2)] : null;
      
      // Winner propagation logic
      let homeTeam, awayTeam;
      if (r === 1) {
        homeTeam = teams[m * 2];
        awayTeam = teams[m * 2 + 1];
      } else {
        // Find the winners from the previous round
        const prevRound = r - 1;
        const matchIdx1 = m * 2;
        const matchIdx2 = m * 2 + 1;
        
        // Find matches in matchesOutput that were just created
        const match1 = matchesOutput.find(m_out => m_out.round === prevRound && m_out.matchOrder === matchIdx1);
        const match2 = matchesOutput.find(m_out => m_out.round === prevRound && m_out.matchOrder === matchIdx2);
        
        homeTeam = teams.find(t => t.id === match1.winnerId);
        awayTeam = teams.find(t => t.id === match2.winnerId);
      }

      function generateMR8Score() {
        let h = 0;
        let a = 0;
        while (h < 9 && a < 9) {
          if (Math.random() > 0.5) h++;
          else a++;
          
          if (h === 8 && a === 8) {
            while (Math.abs(h - a) < 2 && h < 13 && a < 13) {
              if (Math.random() > 0.5) h++;
              else a++;
            }
            break;
          }
        }
        return { h, a };
      }

      const { h: homeScore, a: awayScore } = generateMR8Score();
      
      const status = 'COMPLETED';
      let winnerId = null;
      if (homeScore > awayScore) winnerId = homeTeam?.id;
      else if (awayScore > homeScore) winnerId = awayTeam?.id;
      else winnerId = homeTeam?.id;

      matchesOutput.push({
        id: matchId,
        tournamentId,
        homeTeamId: homeTeam?.id || null,
        awayTeamId: awayTeam?.id || null,
        homeScore,
        awayScore,
        round: r,
        matchOrder: m,
        nextMatchId,
        status,
        winnerId,
        bestOf: 1,
        scoreLimit: 9,
      });
    }
  }

  await prisma.match.createMany({ data: matchesOutput });

  console.log('Writing massive_wingman_stats.json...');
  fs.writeFileSync('massive_wingman_stats.json', JSON.stringify(stats, null, 2));

  console.log('--- Massive Data Build Complete ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
