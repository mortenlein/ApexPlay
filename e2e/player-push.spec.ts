import fs from 'fs';
import path from 'path';
import { expect, test } from '@playwright/test';
import { apiAnon, apiAs, disposeApiContexts, json } from './helpers/api';
import { clearPushSubscriptions, createCallableMatch, prisma, readPushSubscriptions } from './helpers/lan-seed';
import { loginAs, mintSessionToken, personaUserId } from './helpers/auth';

/**
 * Web push — the channel that gets a player off the sofa and onto their station.
 *
 * VAPID is deliberately *configured* for the e2e run (playwright.config.ts), because
 * `sendPushToUsers` returns before it touches a subscription when it isn't, which would make
 * every assertion here pass for the wrong reason.
 *
 * Mirrors playwright.config.ts. Hardcoded rather than read from process.env, which isn't
 * reliably propagated into Playwright worker processes (see helpers/auth.ts for the same note).
 */
const VAPID_PUBLIC_KEY = 'BJEVgFRpP8GtXwHqfpwTfPVWJdA5MwqHPkhXgiXo7caRItlOoBBHAE3KZ0JBNCfEV2z-VFRagJ9zdZ8lhgAEaNw';

/**
 * Where src/lib/push.ts writes one JSON line per delivery attempt (PUSH_DELIVERY_LOG). Mirrors
 * playwright.config.ts, for the same reason the VAPID key above does — the payload itself is
 * encrypted with the subscriber's keys, so this file is the only way to read what was sent.
 */
const DELIVERY_LOG = path.resolve(process.cwd(), 'prisma', `e2e-${process.env.E2E_PORT || '4101'}-push.log`);

interface DeliveryAttempt {
  endpoint: string;
  userId: string;
  payload: { title: string; body: string; url?: string; tag?: string };
}

function truncateDeliveryLog() {
  fs.writeFileSync(DELIVERY_LOG, '');
}

function deliveryAttempts(): DeliveryAttempt[] {
  if (!fs.existsSync(DELIVERY_LOG)) return [];
  return fs
    .readFileSync(DELIVERY_LOG, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as DeliveryAttempt);
}

/** A well-formed browser subscription — real P-256 material, an endpoint that goes nowhere. */
function fakeSubscription(endpoint: string, auth = 'qjtHBn7VLXmUhG8TD9kV0g') {
  return {
    endpoint,
    expirationTime: null,
    keys: {
      p256dh: 'BMStS9VxjuUvtY-u77pPKa0SAM_SLOAm2ltzUyvbIiMttuO_G7vst3hqVtLmvBoYwie0oR1E8onsk50tgiDcyUo',
      auth,
    },
  };
}

test.describe.configure({ mode: 'serial' });
test.afterEach(disposeApiContexts);

test('the public key endpoint hands the browser the configured VAPID key', async () => {
  // Anonymous on purpose: the browser needs the key before it has asked for notifications.
  const anon = await apiAnon();
  const res = await anon.get('/api/push/public-key');
  expect(res.status()).toBe(200);
  expect(await json(res)).toEqual({ publicKey: VAPID_PUBLIC_KEY });
});

test('subscribing stores one row per endpoint, and re-subscribing refreshes it in place', async () => {
  await mintSessionToken('leo');
  const leoUserId = await personaUserId('leo');
  await clearPushSubscriptions(leoUserId);
  const leo = await apiAs('leo');
  const endpoint = `https://127.0.0.1:1/push/${Date.now()}`;

  const first = await leo.post('/api/push/subscribe', { data: fakeSubscription(endpoint) });
  expect(first.status()).toBe(200);
  expect(await json(first)).toEqual({ success: true });

  const stored = await readPushSubscriptions(leoUserId);
  expect(stored).toHaveLength(1);
  expect(stored[0]).toMatchObject({ endpoint, userId: leoUserId, auth: 'qjtHBn7VLXmUhG8TD9kV0g' });

  // The browser rotates the subscription's keys without changing the endpoint; `endpoint` is
  // unique in the schema, so this has to be an update, never a second row or a 500.
  const again = await leo.post('/api/push/subscribe', { data: fakeSubscription(endpoint, 'Zm9yY2VkLXJvdGF0aW9uMQ') });
  expect(again.status()).toBe(200);

  const rotated = await readPushSubscriptions(leoUserId);
  expect(rotated).toHaveLength(1);
  expect(rotated[0].id).toBe(stored[0].id);
  expect(rotated[0].auth).toBe('Zm9yY2VkLXJvdGF0aW9uMQ');
});

test('unsubscribing drops the caller’s own subscription and nobody else’s', async () => {
  await mintSessionToken('leo');
  await mintSessionToken('sam');
  const leoUserId = await personaUserId('leo');
  const samUserId = await personaUserId('sam');
  await clearPushSubscriptions(leoUserId);
  await clearPushSubscriptions(samUserId);

  const leo = await apiAs('leo');
  const sam = await apiAs('sam');
  const leoEndpoint = `https://127.0.0.1:1/push/leo-${Date.now()}`;
  const samEndpoint = `https://127.0.0.1:1/push/sam-${Date.now()}`;
  await leo.post('/api/push/subscribe', { data: fakeSubscription(leoEndpoint) });
  await sam.post('/api/push/subscribe', { data: fakeSubscription(samEndpoint) });

  // Leo naming Sam's endpoint must not silence Sam: the delete is scoped by userId too.
  expect((await leo.post('/api/push/unsubscribe', { data: { endpoint: samEndpoint } })).status()).toBe(200);
  expect(await readPushSubscriptions(samUserId)).toHaveLength(1);

  expect((await leo.post('/api/push/unsubscribe', { data: { endpoint: leoEndpoint } })).status()).toBe(200);
  expect(await readPushSubscriptions(leoUserId)).toHaveLength(0);

  // Unsubscribing twice is idempotent, not an error — the browser retries this on its own.
  expect((await leo.post('/api/push/unsubscribe', { data: { endpoint: leoEndpoint } })).status()).toBe(200);
});

test('push endpoints refuse anonymous callers and malformed subscriptions', async () => {
  const anon = await apiAnon();
  const endpoint = 'https://127.0.0.1:1/push/anon';

  // A subscription is tied to an identity; there is nobody to notify without a session.
  expect((await anon.post('/api/push/subscribe', { data: fakeSubscription(endpoint) })).status()).toBe(401);
  expect((await anon.post('/api/push/unsubscribe', { data: { endpoint } })).status()).toBe(401);

  const leo = await apiAs('leo');
  // Keys are what the payload is encrypted with — a subscription without them is unusable.
  const noKeys = await leo.post('/api/push/subscribe', { data: { endpoint } });
  expect(noKeys.status()).toBe(400);
  expect((await json(noKeys)).error).toMatch(/invalid subscription/i);

  expect((await leo.post('/api/push/subscribe', { data: { keys: fakeSubscription(endpoint).keys } })).status()).toBe(400);
  expect((await leo.post('/api/push/unsubscribe', { data: {} })).status()).toBe(400);

  // Unsubscribing is a POST — there is no DELETE handler on the route.
  expect((await leo.delete('/api/push/unsubscribe')).status()).toBe(405);
});

test('calling a match attempts delivery to a dead endpoint without breaking the request', async () => {
  await mintSessionToken('leo');
  const leoUserId = await personaUserId('leo');
  await clearPushSubscriptions(leoUserId);

  const leo = await apiAs('leo');
  const endpoint = `https://127.0.0.1:1/push/dead-${Date.now()}`;
  expect((await leo.post('/api/push/subscribe', { data: fakeSubscription(endpoint) })).status()).toBe(200);

  // Leo is on the home roster, so notifyMatchReady() resolves him as a push recipient.
  const { match, tournament } = await createCallableMatch({ homeUserId: leoUserId });
  const mia = await apiAs('mia');
  const called = await mia.post(`/api/matches/${match.id}/load`);

  // The send fails at the socket (nothing listens on port 1) — best-effort means the marshal
  // still gets a successful call, not a 500 from someone else's broken phone.
  expect(called.status()).toBe(200);
  expect((await json(called)).match.status).toBe('READY');

  // src/lib/push.ts prunes ONLY on 404/410 ("the subscription is dead"). A connection error is
  // not evidence of that, so the row must survive to be retried on the next call.
  expect(await readPushSubscriptions(leoUserId)).toHaveLength(1);

  // Proof the push was actually attempted rather than skipped: the Discord/in-app announce sits
  // *after* sendPushToUsers in notifyMatchReady, so its log row can only exist if the send
  // returned instead of throwing out of the notify path.
  const { notifications } = await json<{ notifications: any[] }>(
    await mia.get(`/api/notifications/log?tournamentId=${tournament.id}`)
  );
  expect(notifications).toHaveLength(1);
  expect(notifications[0]).toMatchObject({ type: 'MATCH', embed: { title: 'Match ready for players' } });
  // The description names the teams (so two calls in one round both reach the marshal feed).
  expect(notifications[0].embed.description).toContain(tournament.name);
  expect(notifications[0].embed.description).toContain('Round 1');
});

test('the player desk offers to turn match alerts on', async ({ page }) => {
  await loginAs(page, 'leo');
  await page.goto('/dashboard');

  // Push is configured server-side for this run, so the opt-in has to be reachable. (The
  // "hidden when unconfigured" branch keys off VAPID_PUBLIC_KEY being null, which is a
  // server-start env decision and so not togglable per test.)
  await expect(page.getByRole('button', { name: /Enable match alerts/i })).toBeVisible();
});

/**
 * The one string in the app that most has to be in the player's own language: a lock-screen
 * alert telling a 12-year-old to get to their station, written minutes after they last loaded a
 * page. There is no request to read a locale off — the request belongs to the marshal who
 * pressed "call match", and this suite pins *her* to English — so the language can only come
 * from `User.locale`, stored when the player last used the switch.
 *
 * Two players on the same match, two languages, therefore two payloads: `notifyMatchReady` has
 * to group its recipients and compose per group, not compose once for everybody.
 */
test('two players on one match are each written to in their own language', async () => {
  await mintSessionToken('leo');
  await mintSessionToken('sam');
  const leoUserId = await personaUserId('leo');
  const samUserId = await personaUserId('sam');
  await prisma.user.update({ where: { id: leoUserId }, data: { locale: 'nb' } });
  await prisma.user.update({ where: { id: samUserId }, data: { locale: 'en' } });
  await clearPushSubscriptions(leoUserId);
  await clearPushSubscriptions(samUserId);

  const leo = await apiAs('leo');
  const sam = await apiAs('sam');
  const stamp = Date.now();
  const leoEndpoint = `https://127.0.0.1:1/push/nb-${stamp}`;
  const samEndpoint = `https://127.0.0.1:1/push/en-${stamp}`;
  expect((await leo.post('/api/push/subscribe', { data: fakeSubscription(leoEndpoint) })).status()).toBe(200);
  expect((await sam.post('/api/push/subscribe', { data: fakeSubscription(samEndpoint) })).status()).toBe(200);

  // One match, one roster each, so both are recipients of the same call.
  const { match } = await createCallableMatch({ homeUserId: leoUserId, awayUserId: samUserId });

  truncateDeliveryLog();
  const mia = await apiAs('mia');
  expect((await mia.post(`/api/matches/${match.id}/load`)).status()).toBe(200);

  await expect.poll(() => deliveryAttempts().length).toBe(2);
  const attempts = deliveryAttempts();
  const toLeo = attempts.find((a) => a.endpoint === leoEndpoint)!;
  const toSam = attempts.find((a) => a.endpoint === samEndpoint)!;
  expect(toLeo, 'the Norwegian player was written to').toBeTruthy();
  expect(toSam, 'the English player was written to').toBeTruthy();

  // Norwegian for Leo…
  expect(toLeo.payload.title).toBe('Kampen din er klar');
  expect(toLeo.payload.body).toBe('Home Crew vs Away Crew — gå til plassen din.');
  // …English for Sam, out of the same call, in the same request.
  expect(toSam.payload.title).toBe('Your match is ready');
  expect(toSam.payload.body).toBe('Home Crew vs Away Crew — head to your station.');

  // Both still point at the same match: only the wording is per-player.
  expect(toLeo.payload.tag).toBe(`match-${match.id}`);
  expect(toSam.payload.tag).toBe(toLeo.payload.tag);

  await prisma.user.update({ where: { id: leoUserId }, data: { locale: null } });
  await prisma.user.update({ where: { id: samUserId }, data: { locale: null } });
});

/**
 * `locale: null` is the normal state, not a gap — most players never open the language switch.
 * This is a Norwegian club, so silence means bokmål, whatever language the marshal's own session
 * that triggered the call happens to be in.
 */
test('a player who never picked a language is written to in Norwegian', async () => {
  await mintSessionToken('leo');
  const leoUserId = await personaUserId('leo');
  await prisma.user.update({ where: { id: leoUserId }, data: { locale: null } });
  await clearPushSubscriptions(leoUserId);

  const leo = await apiAs('leo');
  const endpoint = `https://127.0.0.1:1/push/default-${Date.now()}`;
  expect((await leo.post('/api/push/subscribe', { data: fakeSubscription(endpoint) })).status()).toBe(200);

  const { match } = await createCallableMatch({ homeUserId: leoUserId });
  truncateDeliveryLog();
  const mia = await apiAs('mia');
  expect((await mia.post(`/api/matches/${match.id}/load`)).status()).toBe(200);

  await expect.poll(() => deliveryAttempts().length).toBe(1);
  expect(deliveryAttempts()[0].payload.title).toBe('Kampen din er klar');

  // Live is its own line: the match is not "ready" any more, it is running without them.
  truncateDeliveryLog();
  expect((await mia.post(`/api/matches/${match.id}`, { data: { status: 'LIVE' } })).status()).toBe(200);
  await expect.poll(() => deliveryAttempts().length).toBe(1);
  expect(deliveryAttempts()[0].payload.title).toBe('Live nå');
  expect(deliveryAttempts()[0].payload.body).toBe('Home Crew vs Away Crew — kom deg til plassen din.');
});
