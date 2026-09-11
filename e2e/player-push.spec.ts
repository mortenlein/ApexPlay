import { expect, test } from '@playwright/test';
import { apiAnon, apiAs, disposeApiContexts, json } from './helpers/api';
import { clearPushSubscriptions, createCallableMatch, readPushSubscriptions } from './helpers/lan-seed';
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
  expect(notifications[0]).toMatchObject({
    type: 'MATCH',
    embed: { title: 'Match ready for players', description: `**${tournament.name}** · Round 1` },
  });
});

test('the player desk offers to turn match alerts on', async ({ page }) => {
  await loginAs(page, 'leo');
  await page.goto('/dashboard');

  // Push is configured server-side for this run, so the opt-in has to be reachable. (The
  // "hidden when unconfigured" branch keys off VAPID_PUBLIC_KEY being null, which is a
  // server-start env decision and so not togglable per test.)
  await expect(page.getByRole('button', { name: /Enable match alerts/i })).toBeVisible();
});
