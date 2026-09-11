import { expect, test } from '@playwright/test';
import { apiAnon, apiAs, disposeApiContexts, json } from './helpers/api';
import { E2E_BASE_URL, mintSessionToken } from './helpers/auth';
import {
  addMatch,
  createBridgedMatch,
  createTeam,
  fakeBridgeToken,
  nextSteamId,
  readAuditRows,
  readMatch,
  readTournament,
} from './helpers/lan-seed';

/**
 * The EON bridge: EON runs on the observer machine, cannot be reached from here, and pushes
 * parsed GSI frames outward to `POST /api/webhooks/eon` with a per-tournament bearer token.
 *
 * Two contracts are under test. The *token* is a webhook credential — admin-only to read, and
 * rotating or disabling it must lock the old one out immediately. The *frame* is identified
 * purely by steamid (`/home/mole/apps/eon/src/server/apexplay-bridge.js` sends each side's
 * steamids plus `score`/`matches_won_this_series`), which is what makes scores survive a side
 * swap: ApexPlay works out which of its teams is currently CT rather than trusting CT to be home.
 */
test.describe.configure({ mode: 'serial' });
test.afterEach(disposeApiContexts);

type Side = { score?: number; series?: number; steamids?: string[] };

/** A frame in exactly the shape the EON bridge posts (docs/apexplay-bridge.md). */
function eonFrame(ct: Side, t: Side, overrides: { map?: any; round?: any } = {}) {
  return {
    map: overrides.map ?? { name: 'de_dust2', phase: 'live' },
    round: overrides.round ?? { phase: 'live' },
    ct: { score: 0, series: 0, steamids: [], ...ct },
    t: { score: 0, series: 0, steamids: [], ...t },
  };
}

/** POST a frame as the bridge would: `Authorization: Bearer <tournament token>`. */
async function postFrame(token: string | null, frame: unknown) {
  const api = await apiAnon();
  return api.post('/api/webhooks/eon', {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    data: frame as any,
  });
}

/**
 * Read an SSE endpoint until `until` matches a `data:` frame (or the timeout expires), firing
 * `trigger` once the connection is up — the stream registers its eventBus listener before it
 * flushes the `: connected` comment, so a mutation triggered after that first chunk is seen.
 */
async function collectSse(
  path: string,
  options: {
    cookie?: string;
    trigger?: () => Promise<void>;
    until?: (frame: any) => boolean;
    timeoutMs?: number;
  } = {}
): Promise<any[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 12000);
  const frames: any[] = [];

  try {
    const response = await fetch(`${E2E_BASE_URL}${path}`, {
      headers: options.cookie ? { cookie: options.cookie } : {},
      signal: controller.signal,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');

    const decoder = new TextDecoder();
    let buffer = '';
    let triggered = false;

    for await (const chunk of response.body as any) {
      buffer += decoder.decode(chunk as Uint8Array, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';
      for (const part of parts) {
        const dataLine = part.split('\n').find((line) => line.startsWith('data: '));
        if (!dataLine) continue;
        try {
          frames.push(JSON.parse(dataLine.slice(6)));
        } catch {
          /* not our payload */
        }
      }

      if (!triggered && options.trigger) {
        triggered = true;
        await options.trigger();
      }
      if (options.until && frames.some(options.until)) break;
    }
  } catch {
    // Aborted on timeout (or when we stop reading) — whatever arrived is the result.
  } finally {
    clearTimeout(timer);
    controller.abort();
  }

  return frames;
}

test('enabling the bridge mints a token that only an admin can read', async () => {
  const { tournament } = await createBridgedMatch({ token: null });
  const marcus = await apiAs('marcus');
  const leo = await apiAs('leo');
  const anon = await apiAnon();

  const enabled = await marcus.post(`/api/tournaments/${tournament.id}/eon-bridge`, {
    data: { action: 'enable' },
  });
  expect(enabled.status()).toBe(200);
  const body = await json(enabled);
  expect(body.enabled).toBe(true);
  expect(body.token).toMatch(/^eon_[0-9a-f]{40}$/);

  // Stored on the tournament, and handed back to the admin panel on a re-read.
  expect((await readTournament(tournament.id))!.eonBridgeToken).toBe(body.token);
  expect(await json(await marcus.get(`/api/tournaments/${tournament.id}/eon-bridge`))).toEqual({
    enabled: true,
    token: body.token,
  });

  // Everyone else is locked out of the credential endpoint entirely.
  expect((await leo.get(`/api/tournaments/${tournament.id}/eon-bridge`)).status()).toBe(401);
  expect((await anon.get(`/api/tournaments/${tournament.id}/eon-bridge`)).status()).toBe(401);
  expect(
    (await leo.post(`/api/tournaments/${tournament.id}/eon-bridge`, { data: { action: 'rotate' } })).status()
  ).toBe(401);

  // The enable is on the audit trail.
  expect((await readAuditRows(tournament.id)).map((row) => row.action)).toContain('eon_bridge.enabled');
});

test('the bridge token never reaches a non-admin through the tournament payload', async () => {
  const { tournament, token } = await createBridgedMatch();
  const marcus = await apiAs('marcus');
  const leo = await apiAs('leo');
  const mia = await apiAs('mia');
  const anon = await apiAnon();

  const asAdmin = await json(await marcus.get(`/api/tournaments/${tournament.id}`));
  expect(asAdmin.eonBridgeToken).toBe(token);

  for (const [who, api] of [
    ['leo', leo],
    ['mia', mia],
    ['anon', anon],
  ] as const) {
    const payload = await json(await api.get(`/api/tournaments/${tournament.id}`));
    expect(payload.id, who).toBe(tournament.id);
    expect(Object.keys(payload), who).not.toContain('eonBridgeToken');
    expect(JSON.stringify(payload), who).not.toContain(token);
  }
});

test('rotating the token locks the old one out, and disabling shuts the door', async () => {
  const { tournament, token: original, match, homeSteamIds, awaySteamIds } = await createBridgedMatch();
  const marcus = await apiAs('marcus');
  const frame = eonFrame({ score: 5, steamids: homeSteamIds }, { score: 3, steamids: awaySteamIds });

  const rotated = await json(
    await marcus.post(`/api/tournaments/${tournament.id}/eon-bridge`, { data: { action: 'rotate' } })
  );
  expect(rotated.enabled).toBe(true);
  expect(rotated.token).toMatch(/^eon_[0-9a-f]{40}$/);
  expect(rotated.token).not.toBe(original);

  // The observer machine still holding the old token is locked out immediately…
  const stale = await postFrame(original, frame);
  expect(stale.status()).toBe(401);
  expect((await json(stale)).error).toBe('Invalid bridge token');
  // …and the new one works.
  expect((await postFrame(rotated.token, frame)).status()).toBe(200);
  expect((await readMatch(match.id)).homeScore).toBe(5);

  const disabled = await marcus.post(`/api/tournaments/${tournament.id}/eon-bridge`, {
    data: { action: 'disable' },
  });
  expect(disabled.status()).toBe(200);
  expect(await json(disabled)).toEqual({ enabled: false, token: null });
  expect((await readTournament(tournament.id))!.eonBridgeToken).toBeNull();
  expect(await json(await marcus.get(`/api/tournaments/${tournament.id}/eon-bridge`))).toEqual({
    enabled: false,
    token: null,
  });

  // With the bridge off, the token that worked a moment ago scores nothing.
  const shut = await postFrame(rotated.token, eonFrame({ score: 13, steamids: homeSteamIds }, { steamids: awaySteamIds }));
  expect(shut.status()).toBe(401);
  expect((await readMatch(match.id)).homeScore).toBe(5);

  expect((await readAuditRows(tournament.id)).map((row) => row.action)).toEqual(
    expect.arrayContaining(['eon_bridge.rotated', 'eon_bridge.disabled'])
  );
});

test('a frame with no token, or a token nobody minted, is refused', async () => {
  const { match, homeSteamIds, awaySteamIds } = await createBridgedMatch();
  const frame = eonFrame({ score: 7, steamids: homeSteamIds }, { steamids: awaySteamIds });

  const missing = await postFrame(null, frame);
  expect(missing.status()).toBe(401);
  expect((await json(missing)).error).toBe('Missing bridge token');

  const bogus = await postFrame(fakeBridgeToken(), frame);
  expect(bogus.status()).toBe(401);
  expect((await json(bogus)).error).toBe('Invalid bridge token');

  expect(await readMatch(match.id)).toMatchObject({ homeScore: 0, status: 'PENDING' });
});

test('a live frame resolves the match by steamid and streams the new score out', async () => {
  const { tournament, token, match, home, homeSteamIds, awaySteamIds } = await createBridgedMatch();
  const staffCookie = `next-auth.session-token=${await mintSessionToken('mia')}`;

  const frames = await collectSse(`/api/tournaments/${tournament.id}/stream`, {
    cookie: staffCookie,
    trigger: async () => {
      const res = await postFrame(token, eonFrame({ score: 13, steamids: homeSteamIds }, { score: 7, steamids: awaySteamIds }));
      expect(res.status()).toBe(200);
      expect(await json(res)).toMatchObject({ ok: true, matchId: match.id, homeIsCT: true });
    },
    until: (frame) => frame?.matchId === match.id && frame?.match?.homeScore === 13,
  });

  // CT roster = home roster, so ct.score lands on homeScore and the match goes live.
  const stored = await readMatch(match.id);
  expect(stored.homeScore).toBe(13);
  expect(stored.awayScore).toBe(7);
  expect(stored.status).toBe('LIVE');
  expect(stored.winnerId).toBeNull();
  expect(JSON.parse(stored.mapScores)).toEqual([{ map: 'de_dust2', home: 13, away: 7 }]);

  const live = frames.find((frame) => frame?.matchId === match.id && frame?.match?.homeScore === 13);
  expect(live, `no live frame for ${match.id}; saw ${JSON.stringify(frames.map((f) => f?.match?.homeScore))}`).toBeTruthy();
  expect(live.tournamentId).toBe(tournament.id);
  expect(live.match.awayScore).toBe(7);
  expect(live.match.status).toBe('LIVE');
  expect(live.match.homeTeamId).toBe(home.id);
});

test('a side swap keeps each team on its own score', async () => {
  const { token, match, homeSteamIds, awaySteamIds } = await createBridgedMatch();

  // First half: home on CT.
  await postFrame(token, eonFrame({ score: 9, steamids: homeSteamIds }, { score: 3, steamids: awaySteamIds }));
  expect(await readMatch(match.id)).toMatchObject({ homeScore: 9, awayScore: 3 });

  // Sides swap: home is now T with 12 rounds, away is CT with 4. Home's rounds must not jump
  // onto awayScore just because the game now calls them terrorists.
  const swapped = await postFrame(token, eonFrame({ score: 4, steamids: awaySteamIds }, { score: 12, steamids: homeSteamIds }));
  expect(swapped.status()).toBe(200);
  expect(await json(swapped)).toMatchObject({ matchId: match.id, homeIsCT: false });

  const afterSwap = await readMatch(match.id);
  expect(afterSwap.homeScore).toBe(12);
  expect(afterSwap.awayScore).toBe(4);
  expect(JSON.parse(afterSwap.mapScores)).toEqual([{ map: 'de_dust2', home: 12, away: 4 }]);
});

test('series wins drive the headline score of a BO3 but never finish the match', async () => {
  const { token, match, homeSteamIds, awaySteamIds } = await createBridgedMatch({ bestOf: 3 });

  // Map 1 in progress: the BO3 headline score is series, not rounds, and map 1's rounds go into
  // mapScores[0] (mapNumber = ct.series + t.series).
  await postFrame(token, eonFrame({ score: 11, series: 0, steamids: homeSteamIds }, { score: 6, series: 0, steamids: awaySteamIds }));
  const midMap = await readMatch(match.id);
  expect(midMap).toMatchObject({ homeScore: 0, awayScore: 0, status: 'LIVE' });
  expect(JSON.parse(midMap.mapScores)).toEqual([{ map: 'de_dust2', home: 11, away: 6 }]);

  // Home takes map 1 and then map 2 — `matches_won_this_series` = 2, which wins the BO3.
  await postFrame(token, eonFrame({ score: 4, series: 1, steamids: homeSteamIds }, { score: 2, series: 0, steamids: awaySteamIds }));
  const seriesWon = await postFrame(
    token,
    eonFrame({ score: 13, series: 2, steamids: homeSteamIds }, { score: 10, series: 0, steamids: awaySteamIds })
  );
  expect(seriesWon.status()).toBe(200);

  const done = await readMatch(match.id);
  expect(done.homeScore).toBe(2);
  expect(done.awayScore).toBe(0);
  // Documented behaviour of the route: it is a *live score* feed only. Winning the series on the
  // server does not complete the match, pick a winner or advance anyone — staff still post the
  // official result through /api/matches/{id}.
  expect(done.status).toBe('LIVE');
  expect(done.winnerId).toBeNull();
  expect(done.resultType).toBeNull();
  // Maps are indexed by `ct.series + t.series`, so each frame's rounds land in the slot for the
  // number of maps already decided: 0 while the series is 0-0, 1 at 1-0, 2 at 2-0.
  expect(JSON.parse(done.mapScores)).toEqual([
    { map: 'de_dust2', home: 11, away: 6 },
    { map: 'de_dust2', home: 4, away: 2 },
    { map: 'de_dust2', home: 13, away: 10 },
  ]);
});

test('frames the route cannot place are skipped, not guessed at', async () => {
  const { token, match } = await createBridgedMatch();

  // Nobody on the server belongs to a roster in this tournament.
  const strangers = await postFrame(
    token,
    eonFrame({ score: 13, steamids: [nextSteamId(), nextSteamId()] }, { score: 1, steamids: [nextSteamId()] })
  );
  expect(strangers.status()).toBe(200);
  expect(await json(strangers)).toEqual({ ok: true, skipped: 'no matching loaded match for these players' });

  // An empty server (warmup, everyone in spectate) is a no-op rather than a 0-0 write.
  const empty = await postFrame(token, eonFrame({ score: 0, steamids: [] }, { score: 0, steamids: [] }));
  expect(empty.status()).toBe(200);
  expect(await json(empty)).toEqual({ ok: true, skipped: 'no players on server' });

  const untouched = await readMatch(match.id);
  expect(untouched).toMatchObject({ homeScore: 0, awayScore: 0, status: 'PENDING' });
  expect(untouched.mapScores).toBe('[]');
});

test('a frame that fits two matches equally is applied to neither', async () => {
  // Regression: the route once broke ties by iteration order and scored an arbitrary match.

  // Same two humans (same steamids) entered in a second match of the same tournament — a
  // duplicated roster, which is exactly the case a steamid-only identification cannot resolve.
  const { tournament, token, match, homeSteamIds, awaySteamIds } = await createBridgedMatch({ rosterSize: 1 });
  const homeAgain = await createTeam(tournament.id, {
    name: 'Home Crew (B)',
    players: [{ name: 'Home 1 again', steamId: homeSteamIds[0] }],
  });
  const awayAgain = await createTeam(tournament.id, {
    name: 'Away Crew (B)',
    players: [{ name: 'Away 1 again', steamId: awaySteamIds[0] }],
  });
  const twin = await addMatch(tournament.id, {
    homeTeamId: homeAgain.id,
    awayTeamId: awayAgain.id,
    matchOrder: 1,
  });

  const res = await postFrame(token, eonFrame({ score: 13, steamids: homeSteamIds }, { score: 2, steamids: awaySteamIds }));
  expect(res.status()).toBe(200);
  expect(await json(res)).toMatchObject({ ok: true, skipped: expect.any(String) });

  for (const id of [match.id, twin.id]) {
    const row = await readMatch(id);
    expect(row, id).toMatchObject({ homeScore: 0, awayScore: 0, status: 'PENDING' });
  }
});

test('a token from another tournament cannot score this one', async () => {
  const other = await createBridgedMatch();
  const mine = await createBridgedMatch();

  // Valid token, valid steamids — but they belong to different tournaments, so the frame finds
  // no match in the token's tournament and is skipped.
  const res = await postFrame(other.token, eonFrame({ score: 13, steamids: mine.homeSteamIds }, { score: 4, steamids: mine.awaySteamIds }));
  expect(res.status()).toBe(200);
  expect(await json(res)).toEqual({ ok: true, skipped: 'no matching loaded match for these players' });

  expect((await readMatch(mine.match.id)).homeScore).toBe(0);
  expect((await readMatch(other.match.id)).homeScore).toBe(0);
});
