import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { eventBus } from '@/lib/eventBus';

/**
 * POST /api/webhooks/eon
 *
 * Inbound live scores from the EON bridge (running next to EON on the observer machine).
 * Auth: per-tournament bridge token (Authorization: Bearer <token> or x-eon-token).
 * The match is auto-identified by mapping the on-server steamids to ApexPlay Player.steamId,
 * which also tells us which ApexPlay team is currently CT vs T (so scores survive side swaps).
 *
 * Body: { map?: {name, phase}, round?: {phase},
 *         ct: {score, series, steamids: []}, t: {score, series, steamids: []} }
 */

type EonSide = { score?: number; series?: number; steamids?: string[] };
type EonPayload = { map?: { name?: string; phase?: string }; round?: { phase?: string }; ct?: EonSide; t?: EonSide };

const num = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const overlap = (players: { steamId: string | null }[], ids: Set<string>) =>
  players.filter((p) => p.steamId && ids.has(String(p.steamId))).length;

function getToken(request: Request) {
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim();
  return request.headers.get('x-eon-token')?.trim() || null;
}

export async function POST(request: Request) {
  const token = getToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Missing bridge token' }, { status: 401 });
  }

  const tournament = await prisma.tournament.findUnique({ where: { eonBridgeToken: token } });
  if (!tournament) {
    return NextResponse.json({ error: 'Invalid bridge token' }, { status: 401 });
  }

  let body: EonPayload;
  try {
    body = (await request.json()) as EonPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const ct = body.ct || {};
  const t = body.t || {};
  const ctIds = new Set((ct.steamids || []).map(String));
  const tIds = new Set((t.steamids || []).map(String));
  const serverIds = new Set<string>([...ctIds, ...tIds]);
  if (serverIds.size === 0) {
    return NextResponse.json({ ok: true, skipped: 'no players on server' });
  }

  const matches = await prisma.match.findMany({
    where: {
      tournamentId: tournament.id,
      status: { notIn: ['COMPLETED', 'FINISHED'] },
      homeTeamId: { not: null },
      awayTeamId: { not: null },
    },
    include: {
      homeTeam: { include: { players: { select: { steamId: true } } } },
      awayTeam: { include: { players: { select: { steamId: true } } } },
    },
  });

  // Identify the match: the active one with players from BOTH teams present on the server.
  let best: (typeof matches)[number] | null = null;
  let bestScore = -1;
  for (const m of matches) {
    const homeOnServer = overlap(m.homeTeam?.players || [], serverIds);
    const awayOnServer = overlap(m.awayTeam?.players || [], serverIds);
    if (homeOnServer > 0 && awayOnServer > 0 && homeOnServer + awayOnServer > bestScore) {
      best = m;
      bestScore = homeOnServer + awayOnServer;
    }
  }
  if (!best) {
    return NextResponse.json({ ok: true, skipped: 'no matching loaded match for these players' });
  }

  // Which side is the home team currently on?
  const homeCt = overlap(best.homeTeam?.players || [], ctIds);
  const homeT = overlap(best.homeTeam?.players || [], tIds);
  const homeIsCT = homeCt >= homeT;

  const homeRounds = homeIsCT ? num(ct.score) : num(t.score);
  const awayRounds = homeIsCT ? num(t.score) : num(ct.score);
  const homeSeries = homeIsCT ? num(ct.series) : num(t.series);
  const awaySeries = homeIsCT ? num(t.series) : num(ct.series);

  // Per-map round scores live in mapScores; the match's headline score is series for BoX,
  // rounds for BO1.
  const mapNumber = num(ct.series) + num(t.series);
  let mapScores: any[];
  try {
    mapScores = typeof best.mapScores === 'string' ? JSON.parse(best.mapScores) : (best.mapScores as any) || [];
  } catch {
    mapScores = [];
  }
  while (mapScores.length <= mapNumber) mapScores.push({ map: '', home: 0, away: 0 });
  mapScores[mapNumber] = { map: body.map?.name || mapScores[mapNumber]?.map || '', home: homeRounds, away: awayRounds };

  const isBo1 = (best.bestOf || 1) <= 1;
  const phaseLive = body.round?.phase === 'live' || body.round?.phase === 'freezetime' || body.map?.phase === 'live';

  const updated = await prisma.match.update({
    where: { id: best.id },
    data: {
      homeScore: isBo1 ? homeRounds : homeSeries,
      awayScore: isBo1 ? awayRounds : awaySeries,
      mapScores: JSON.stringify(mapScores),
      status: phaseLive ? 'LIVE' : best.status,
    },
  });

  const full = await prisma.match.findUnique({
    where: { id: updated.id },
    include: { homeTeam: { include: { players: true } }, awayTeam: { include: { players: true } } },
  });
  if (full) {
    const data = { matchId: full.id, tournamentId: full.tournamentId, match: full };
    eventBus.emit(`match:${full.id}`, data);
    eventBus.emit(`tournament:${full.tournamentId}`, data);
  }

  return NextResponse.json({ ok: true, matchId: best.id, homeIsCT });
}
