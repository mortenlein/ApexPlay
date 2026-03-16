import prisma from './prisma';

export async function getTournament(id: string) {
  return await prisma.tournament.findUnique({
    where: { id },
  });
}

export async function getTournamentWithTeams(id: string) {
  return await prisma.tournament.findUnique({
    where: { id },
    include: {
      teams: {
        include: {
          players: true
        }
      }
    }
  });
}

export async function getMatches(tournamentId: string) {
  return await prisma.match.findMany({
    where: { tournamentId },
    include: {
      homeTeam: true,
      awayTeam: true
    },
    orderBy: [
      { round: 'asc' },
      { matchOrder: 'asc' }
    ]
  });
}

export async function getScoreboard(tournamentId: string) {
  return await prisma.scoreboardEntry.findMany({
    where: { tournamentId },
    include: {
      team: true
    },
    orderBy: {
      points: 'desc'
    }
  });
}
