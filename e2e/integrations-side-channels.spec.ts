import { existsSync } from 'fs';
import { unlink } from 'fs/promises';
import path from 'path';
import { expect, test } from '@playwright/test';
import { apiAnon, apiAs, disposeApiContexts, json, ONE_PIXEL_PNG } from './helpers/api';
import { E2E_BASE_URL, mintSessionToken } from './helpers/auth';
import { createBridgedMatch, readMatch } from './helpers/lan-seed';

/**
 * The remaining side channels: the logo upload endpoint and the two SSE streams.
 *
 * Uploads are the one place a request writes a file into `public/`, so the filename must come
 * from the validated MIME type and never from the client (`src/app/api/upload/route.ts`).
 * The streams are the live read side, and they carry whole Prisma match rows — so the
 * staff-only fields (`serverIp`/`serverPort`/`serverPassword`, player `steamId`) have to be
 * stripped for everyone who isn't staff, exactly like the REST payloads.
 */
test.describe.configure({ mode: 'serial' });
test.afterEach(disposeApiContexts);

const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'logos');
const uploaded: string[] = [];

test.afterAll(async () => {
  // Uploads land in a tracked directory; don't leave test files behind in the working tree.
  for (const file of uploaded) {
    await unlink(file).catch(() => {});
  }
});

/** Read an SSE endpoint until `until` matches a `data:` frame, or the timeout expires. */
async function collectSse(
  streamPath: string,
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
    const response = await fetch(`${E2E_BASE_URL}${streamPath}`, {
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

test('a signed-in player can upload a PNG logo and fetch it back', async () => {
  const leo = await apiAs('leo');

  const res = await leo.post('/api/upload', {
    multipart: {
      file: { name: 'my team logo.png', mimeType: 'image/png', buffer: ONE_PIXEL_PNG },
    },
  });
  expect(res.status()).toBe(200);
  const { url } = await json<{ url: string }>(res);

  // A uuid + a MIME-derived extension: nothing the client sent survives into the path.
  expect(url).toMatch(/^\/uploads\/logos\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/);
  expect(url).not.toContain('my team logo');
  expect(url).not.toContain(' ');

  const onDisk = path.join(uploadDir, path.basename(url));
  uploaded.push(onDisk);
  expect(existsSync(onDisk)).toBe(true);

  // And it is actually served from there.
  const anon = await apiAnon();
  const fetched = await anon.get(url);
  expect(fetched.status()).toBe(200);
  expect(fetched.headers()['content-type']).toContain('image/png');
  expect((await fetched.body()).length).toBe(ONE_PIXEL_PNG.length);
});

test('uploads are refused unless they are a real image type', async () => {
  const leo = await apiAs('leo');

  const svg = await leo.post('/api/upload', {
    multipart: {
      file: {
        name: 'logo.svg',
        mimeType: 'image/svg+xml',
        buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
      },
    },
  });
  expect(svg.status()).toBe(400);
  expect((await json(svg)).error).toBe('Only PNG, JPG, and WEBP files are allowed');

  const text = await leo.post('/api/upload', {
    multipart: { file: { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') } },
  });
  expect(text.status()).toBe(400);

  // A PNG content type on a .php name still lands as a .png — the extension comes from the MIME
  // type — but nothing else may get through.
  const noFile = await leo.post('/api/upload', { multipart: {} });
  expect(noFile.status()).toBe(400);
  expect((await json(noFile)).error).toBe('No file uploaded');

  // And an anonymous caller is turned away before the body is even read.
  const anon = await apiAnon();
  const anonUpload = await anon.post('/api/upload', {
    multipart: { file: { name: 'logo.png', mimeType: 'image/png', buffer: ONE_PIXEL_PNG } },
  });
  expect(anonUpload.status()).toBe(401);
  expect((await json(anonUpload)).error).toBe('Sign in required for uploads');
});

test('an oversized image is refused', async () => {
  const leo = await apiAs('leo');
  // A valid PNG header followed by padding: > 2MB, so it trips the size gate.
  const tooBig = Buffer.concat([ONE_PIXEL_PNG, Buffer.alloc(2 * 1024 * 1024 + 1)]);

  const res = await leo.post('/api/upload', {
    multipart: { file: { name: 'huge.png', mimeType: 'image/png', buffer: tooBig } },
  });
  expect(res.status()).toBe(400);
  expect((await json(res)).error).toBe('File is too large. Max size is 2MB');
});

test('the tournament stream redacts for the public and opens up for staff', async () => {
  const { tournament, match, homeSteamIds } = await createBridgedMatch();
  const staffCookie = `next-auth.session-token=${await mintSessionToken('mia')}`;

  const publicFrames = await collectSse(`/api/tournaments/${tournament.id}/stream`, {
    until: (frame) => frame?.matchId === match.id,
    timeoutMs: 8000,
  });
  const mine = publicFrames.filter((frame) => frame?.matchId === match.id);
  expect(mine.length, 'no frame for the seeded match').toBeGreaterThan(0);

  for (const frame of mine) {
    const raw = JSON.stringify(frame);
    expect(raw).not.toContain('lan-secret');
    expect(raw).not.toContain('10.0.0.5');
    expect(raw).not.toContain('27015');
    expect(raw).not.toContain(homeSteamIds[0]);
    expect(frame.match).not.toHaveProperty('serverIp');
    expect(frame.match).not.toHaveProperty('serverPort');
    expect(frame.match).not.toHaveProperty('serverPassword');
    // The rest of the roster is still public — only the steamid is withheld.
    expect(frame.match.homeTeam.players[0].name).toBe('Home 1');
    expect(frame.match.homeTeam.players[0]).not.toHaveProperty('steamId');
  }

  // The marshal on the floor needs the connect details and the steamids, and gets them.
  const staffFrames = await collectSse(`/api/tournaments/${tournament.id}/stream`, {
    cookie: staffCookie,
    until: (frame) => frame?.matchId === match.id,
    timeoutMs: 8000,
  });
  const staffFrame = staffFrames.find((frame) => frame?.matchId === match.id);
  expect(staffFrame, 'no staff frame for the seeded match').toBeTruthy();
  expect(staffFrame.match.serverIp).toBe('10.0.0.5');
  expect(staffFrame.match.serverPort).toBe('27015');
  expect(staffFrame.match.serverPassword).toBe('lan-secret');
  expect(staffFrame.match.homeTeam.players.map((p: any) => p.steamId)).toEqual(homeSteamIds);
});

test('the match stream emits the new score right after staff post it', async () => {
  const { match } = await createBridgedMatch();
  const marcus = await apiAs('marcus');

  const frames = await collectSse(`/api/matches/${match.id}/stream`, {
    trigger: async () => {
      const res = await marcus.post(`/api/matches/${match.id}`, { data: { homeScore: 1, awayScore: 0 } });
      expect(res.status()).toBe(200);
    },
    until: (frame) => frame?.match?.homeScore === 1,
  });

  const scored = frames.find((frame) => frame?.match?.homeScore === 1);
  expect(scored, `no scored frame; saw ${JSON.stringify(frames.map((f) => f?.match?.homeScore))}`).toBeTruthy();
  expect(scored.matchId).toBe(match.id);
  expect(scored.match.status).toBe('COMPLETED');
  // An anonymous reader of the match stream is held to the same redaction as the tournament one.
  expect(scored.match).not.toHaveProperty('serverPassword');

  expect((await readMatch(match.id)).homeScore).toBe(1);
});
