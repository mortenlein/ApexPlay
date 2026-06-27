import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { eventBus } from "@/lib/eventBus";

type Cs2TeamPayload = {
  name?: string;
  score?: number;
  seriesScore?: number;
  series_score?: number;
};

type Cs2WebhookPayload = {
  event?: string;
  matchId?: string;
  match_id?: string;
  tournamentId?: string;
  tournament_id?: string;
  team1?: Cs2TeamPayload;
  team2?: Cs2TeamPayload;
  winner?: "team1" | "team2" | "home" | "away";
  mapNumber?: number;
  map_number?: number;
  player?: {
    steamId?: string;
    steamid?: string;
    name?: string;
    team?: string;
    teamNum?: number;
  };
  players?: Array<{
    steamId?: string;
    steamid?: string;
    name?: string;
    team?: string;
    teamNum?: number;
    kills?: number;
    deaths?: number;
    assists?: number;
  }>;
  attacker?: {
    steamId?: string;
    steamid?: string;
    name?: string;
  };
  victim?: {
    steamId?: string;
    steamid?: string;
    name?: string;
  };
  assister?: {
    steamId?: string;
    steamid?: string;
    name?: string;
  };
  message?: string;
  text?: string;
};

function getPayloadMatchId(payload: Cs2WebhookPayload) {
  return payload.matchId || payload.match_id;
}

function getPayloadTournamentId(payload: Cs2WebhookPayload) {
  return payload.tournamentId || payload.tournament_id;
}

function normalizeScore(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function getSeriesScore(team: Cs2TeamPayload | undefined, fallback: number) {
  if (!team) return fallback;
  return normalizeScore(team.seriesScore ?? team.series_score, fallback);
}

const ACTIVE_MATCH_STATUSES = ["PENDING", "READY", "WAITING_FOR_PLAYERS", "IN_PROGRESS", "LIVE"];

function namesMatch(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

// A name we're allowed to overwrite with the live server name (bracket placeholder, not a
// deliberately chosen team name). Used to fill in "TBA"/"Team 1" once a match goes live.
function looksLikePlaceholderName(name: string | null | undefined) {
  if (!name) return true;
  const n = name.trim().toLowerCase();
  if (!n) return true;
  return (
    /^team\s*\d*$/.test(n) ||
    n === "tba" ||
    n === "tbd" ||
    n === "bye" ||
    n.startsWith("winner of") ||
    n.startsWith("loser of")
  );
}

/**
 * Resolve which match a webhook is about — deterministically, never by guessing.
 *
 * 1. Explicit `matchId` (the real plugin flow via Load Match) is trusted. An unknown id is a
 *    config error, so we ignore the event rather than fall through to some other match.
 * 2. Otherwise we only resolve *within an explicit tournament*, and only when the target is
 *    unambiguous (exactly one active match, or exactly one whose two team names match the
 *    payload). We never fall back to "the most recent LIVE match" globally — that's how a
 *    stray webhook used to rewrite an unrelated match's score.
 */
async function resolveMatch(payload: Cs2WebhookPayload) {
  const directId = getPayloadMatchId(payload);
  let match: any = null;
  let resolvedByExplicitId = false;

  if (directId) {
    match = await prisma.match.findUnique({
      where: { id: directId },
      include: { homeTeam: true, awayTeam: true },
    });
    if (!match) {
      console.warn(`[CS2 Webhook] Unknown matchId "${directId}"; ignoring event.`);
      return null;
    }
    resolvedByExplicitId = true;
  }

  if (!match) {
    const tournamentId = getPayloadTournamentId(payload);
    if (!tournamentId) {
      return null;
    }

    const candidates = await prisma.match.findMany({
      where: { tournamentId, status: { in: ACTIVE_MATCH_STATUSES } },
      include: { homeTeam: true, awayTeam: true },
      orderBy: [{ round: "asc" }, { matchOrder: "asc" }],
    });

    if (candidates.length === 1) {
      match = candidates[0];
    } else if (candidates.length > 1) {
      const t1 = payload.team1?.name;
      const t2 = payload.team2?.name;
      const exact = candidates.filter((m) => {
        const h = m.homeTeam?.name;
        const a = m.awayTeam?.name;
        return (
          (namesMatch(h, t1) && namesMatch(a, t2)) ||
          (namesMatch(h, t2) && namesMatch(a, t1))
        );
      });
      if (exact.length === 1) {
        match = exact[0];
      } else {
        console.warn(
          `[CS2 Webhook] Ambiguous match in tournament ${tournamentId}: ${candidates.length} active, ${exact.length} name matches. Ignoring event.`
        );
        return null;
      }
    } else {
      return null;
    }
  }

  // Only sync names when resolution is trustworthy (explicit matchId) AND the stored name is
  // still a placeholder. Never clobber an organizer-set name from a live payload.
  if (match && resolvedByExplicitId) {
    const { homeKey, awayKey } = resolveTeamMapping(match, payload);
    const liveHomeName = payload[homeKey]?.name;
    const liveAwayName = payload[awayKey]?.name;

    if (liveHomeName && match.homeTeamId && looksLikePlaceholderName(match.homeTeam?.name)) {
      await prisma.team.update({ where: { id: match.homeTeamId }, data: { name: liveHomeName } });
    }
    if (liveAwayName && match.awayTeamId && looksLikePlaceholderName(match.awayTeam?.name)) {
      await prisma.team.update({ where: { id: match.awayTeamId }, data: { name: liveAwayName } });
    }
  }

  return match;
}

function resolveTeamMapping(match: any, payload: Cs2WebhookPayload): { homeKey: "team1" | "team2"; awayKey: "team1" | "team2" } {
  const homeName = match.homeTeam?.name;
  // Map by exact name when the teams are distinguishable…
  if (namesMatch(homeName, payload.team1?.name)) {
    return { homeKey: "team1", awayKey: "team2" };
  }
  if (namesMatch(homeName, payload.team2?.name)) {
    return { homeKey: "team2", awayKey: "team1" };
  }
  // …otherwise assume the plugin's natural order (team1 = home).
  return { homeKey: "team1", awayKey: "team2" };
}

async function getFullMatch(matchId: string) {
  return prisma.match.findUnique({
    where: { id: matchId },
    include: {
      homeTeam: { include: { players: true } },
      awayTeam: { include: { players: true } },
    },
  });
}

function broadcastUpdate(match: any) {
  const data = {
    matchId: match.id,
    tournamentId: match.tournamentId,
    match,
  };
  eventBus.emit(`match:${match.id}`, data);
  eventBus.emit(`tournament:${match.tournamentId}`, data);
}

function broadcastTelemetry(matchId: string, tournamentId: string, eventType: string, payload: Cs2WebhookPayload) {
  const data = {
    matchId,
    tournamentId,
    telemetry: {
      event: eventType,
      timestamp: new Date().toISOString(),
      payload,
    },
  };
  eventBus.emit(`match:${matchId}`, data);
  eventBus.emit(`tournament:${tournamentId}`, data);
}

async function handleMatchLive(payload: Cs2WebhookPayload) {
  const match = await resolveMatch(payload);
  if (!match) return;
  const updated = await prisma.match.update({
    where: { id: match.id },
    data: { status: "LIVE" },
  });
  const full = await getFullMatch(updated.id);
  if (full) broadcastUpdate(full);
}

async function handleRoundEnd(payload: Cs2WebhookPayload) {
  const match = await resolveMatch(payload);
  if (!match) return;
  const { homeKey, awayKey } = resolveTeamMapping(match, payload);

  const mapNumber = normalizeScore(payload.mapNumber ?? payload.map_number, 0);
  const homeScore = normalizeScore(payload[homeKey]?.score, 0);
  const awayScore = normalizeScore(payload[awayKey]?.score, 0);

  const existingMapScores = typeof match.mapScores === "string" ? JSON.parse(match.mapScores) : (match.mapScores || []);
  while (existingMapScores.length <= mapNumber) {
    existingMapScores.push({ map: "", home: 0, away: 0 });
  }
  existingMapScores[mapNumber].home = homeScore;
  existingMapScores[mapNumber].away = awayScore;

  const updated = await prisma.match.update({
    where: { id: match.id },
    data: {
      status: "LIVE",
      mapScores: JSON.stringify(existingMapScores),
    },
  });
  const full = await getFullMatch(updated.id);
  if (full) broadcastUpdate(full);
}

async function handleMapResult(payload: Cs2WebhookPayload) {
  const match = await resolveMatch(payload);
  if (!match) return;
  const { homeKey, awayKey } = resolveTeamMapping(match, payload);

  const updated = await prisma.match.update({
    where: { id: match.id },
    data: {
      status: "LIVE",
      homeScore: getSeriesScore(payload[homeKey], match.homeScore),
      awayScore: getSeriesScore(payload[awayKey], match.awayScore),
    },
  });
  const full = await getFullMatch(updated.id);
  if (full) broadcastUpdate(full);
}

async function handleMatchEnd(payload: Cs2WebhookPayload) {
  const match = await resolveMatch(payload);
  if (!match) return;
  const { homeKey, awayKey } = resolveTeamMapping(match, payload);

  const homeScore = getSeriesScore(payload[homeKey], match.homeScore);
  const awayScore = getSeriesScore(payload[awayKey], match.awayScore);

  let winnerId: string | null = null;
  let loserId: string | null = null;
  if (payload.winner === "home") {
    winnerId = match.homeTeamId;
    loserId = match.awayTeamId;
  } else if (payload.winner === "away") {
    winnerId = match.awayTeamId;
    loserId = match.homeTeamId;
  } else if (payload.winner === homeKey) {
    winnerId = match.homeTeamId;
    loserId = match.awayTeamId;
  } else if (payload.winner === awayKey) {
    winnerId = match.awayTeamId;
    loserId = match.homeTeamId;
  } else if (homeScore > awayScore) {
    winnerId = match.homeTeamId;
    loserId = match.awayTeamId;
  } else if (awayScore > homeScore) {
    winnerId = match.awayTeamId;
    loserId = match.homeTeamId;
  }

  const updated = await prisma.match.update({
    where: { id: match.id },
    data: {
      status: "COMPLETED",
      homeScore,
      awayScore,
      winnerId,
    },
  });

  if (winnerId && match.nextMatchId) {
    const placeWinnerHome = match.nextMatchSlot ? match.nextMatchSlot === "HOME" : match.matchOrder % 2 === 0;
    await prisma.match.update({
      where: { id: match.nextMatchId },
      data: placeWinnerHome ? { homeTeamId: winnerId } : { awayTeamId: winnerId },
    });
  }

  if (loserId && match.loserNextMatchId) {
    const placeLoserHome = match.loserNextMatchSlot ? match.loserNextMatchSlot === "HOME" : match.matchOrder % 2 === 0;
    await prisma.match.update({
      where: { id: match.loserNextMatchId },
      data: placeLoserHome ? { homeTeamId: loserId } : { awayTeamId: loserId },
    });
  }

  const fullUpdated = await getFullMatch(updated.id);
  if (fullUpdated) {
    broadcastUpdate(fullUpdated);
  }

  if (match.nextMatchId) {
    const nextMatch = await getFullMatch(match.nextMatchId);
    if (nextMatch) broadcastUpdate(nextMatch);
  }
  if (match.loserNextMatchId) {
    const loserNext = await getFullMatch(match.loserNextMatchId);
    if (loserNext) broadcastUpdate(loserNext);
  }
}

async function handlePlayerStatus(payload: Cs2WebhookPayload, isOnline: boolean) {
  const steamId = payload.player?.steamId || payload.player?.steamid;
  if (!steamId) return;

  const result = await prisma.player.updateMany({
    where: { steamId },
    data: { isOnline },
  });
  if (result.count === 0) return;

  const match = await resolveMatch(payload);
  if (!match) return;

  const full = await getFullMatch(match.id);
  if (full) broadcastUpdate(full);
}

async function handleTeamChange(payload: Cs2WebhookPayload) {
  const steamId = payload.player?.steamId || payload.player?.steamid;
  if (!steamId) return;

  await prisma.player.updateMany({
    where: { steamId },
    data: { isOnline: true },
  });

  const match = await resolveMatch(payload);
  if (!match) return;

  const full = await getFullMatch(match.id);
  if (full) {
    broadcastUpdate(full);
    broadcastTelemetry(full.id, full.tournamentId, "team_change", payload);
  }
}

async function handlePlayerSnapshot(payload: Cs2WebhookPayload) {
  const rows = Array.isArray(payload.players) ? payload.players : [];
  if (rows.length === 0) return;

  const steamIds = rows
    .map((row) => row.steamId || row.steamid)
    .filter((id): id is string => !!id);

  if (steamIds.length > 0) {
    await prisma.player.updateMany({
      where: { steamId: { in: steamIds } },
      data: { isOnline: true },
    });
  }

  const match = await resolveMatch(payload);
  const matchId = match?.id || "live_discovery";
  const tournamentId = match?.tournamentId || "live_discovery";

  if (match && steamIds.length > 0) {
    const teamIds = [match.homeTeamId, match.awayTeamId].filter((id): id is string => !!id);
    if (teamIds.length > 0) {
      await prisma.player.updateMany({
        where: {
          teamId: { in: teamIds },
          steamId: { notIn: steamIds },
        },
        data: { isOnline: false },
      });
    }
  }

  const full = match ? await getFullMatch(match.id) : null;
  if (full) {
    broadcastUpdate(full);
  }
  
  broadcastTelemetry(matchId, tournamentId, "player_snapshot", payload);
}

async function handleTelemetryOnly(payload: Cs2WebhookPayload, eventType: string) {
  const match = await resolveMatch(payload);
  const matchId = match?.id || "live_discovery";
  const tournamentId = match?.tournamentId || "live_discovery";
  
  broadcastTelemetry(matchId, tournamentId, eventType, payload);
}

async function mirrorWebhook(payload: Cs2WebhookPayload) {
  const mirrorUrl = process.env.CS2_WEBHOOK_MIRROR_URL?.trim();
  if (!mirrorUrl) return;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-ApexPlay-Source": "cs2-webhook",
    };

    const mirrorKey = process.env.CS2_WEBHOOK_MIRROR_KEY?.trim();
    if (mirrorKey) {
      headers.Authorization = `Bearer ${mirrorKey}`;
    }

    const response = await fetch(mirrorUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(1500),
    });

    if (!response.ok) {
      console.warn(`[CS2 Webhook] Mirror failed: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.warn("[CS2 Webhook] Mirror request failed:", error);
  }
}

export async function POST(request: Request) {
  const webhookKey = process.env.CS2_WEBHOOK_KEY;
  // Fail closed: a missing key is a misconfiguration, not an open door.
  if (!webhookKey) {
    console.error("[CS2 Webhook] CS2_WEBHOOK_KEY is not set; rejecting request.");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }
  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${webhookKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as Cs2WebhookPayload;
    const eventType = payload.event || "";

    switch (eventType) {
      case "match_live":
      case "series_start":
      case "going_live":
      case "match_start":
        await handleMatchLive(payload);
        break;
      case "round_start":
        await handleTelemetryOnly(payload, eventType);
        break;
      case "round_end":
      case "round_winner":
        await handleRoundEnd(payload);
        break;
      case "map_result":
        await handleMapResult(payload);
        break;
      case "match_end":
      case "series_end":
        await handleMatchEnd(payload);
        break;
      case "player_connect":
        await handlePlayerStatus(payload, true);
        break;
      case "player_disconnect":
        await handlePlayerStatus(payload, false);
        break;
      case "team_change":
        await handleTeamChange(payload);
        break;
      case "player_snapshot":
        await handlePlayerSnapshot(payload);
        break;
      case "player_death":
      case "player_hurt":
      case "chat_message":
        await handleTelemetryOnly(payload, eventType);
        break;
      case "heartbeat":
        // Valid plugin health ping; no DB mutation needed.
        break;
      default:
        // Unknown events are accepted to keep plugin rollout safe.
        break;
    }

    await mirrorWebhook(payload);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[CS2 Webhook] Error:", error);
    return NextResponse.json({ error: error?.message || "Failed to process webhook event" }, { status: 500 });
  }
}
