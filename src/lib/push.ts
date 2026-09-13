import fs from "fs";
import webpush from "web-push";
import prisma from "@/lib/prisma";
import { LOCALES, type Locale } from "@/i18n/config";
import { userLocale } from "@/i18n/server";

let configured = false;

export function isPushConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function ensureConfigured(): boolean {
  if (configured) return true;
  if (!isPushConfigured()) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@summit.local",
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/** One language and everybody who should be written to in it. */
export interface PushAudience {
  locale: Locale;
  userIds: string[];
}

/**
 * Split push recipients by the language each of them reads.
 *
 * A push is composed on a server that has no request from the recipient to read a locale off —
 * the request on the stack belongs to the marshal who pressed "call match". The player's own
 * choice was stored on their row when they switched (`POST /api/me/locale`), and that is the only
 * thing here that knows what language to write in.
 *
 * `locale: null` is the normal state, not a gap: most players never touch the switch, and this is
 * a Norwegian club, so they get bokmål. A user id with no row (or no subscription) simply lands in
 * the default group and falls out later when no subscription is found for it.
 *
 * Returned in `LOCALES` order so the output is stable for callers and tests.
 */
export async function groupUsersByLocale(userIds: string[]): Promise<PushAudience[]> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (unique.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, locale: true },
  });
  const stored = new Map(users.map((user) => [user.id, userLocale(user.locale)]));

  const grouped = new Map<Locale, string[]>();
  for (const id of unique) {
    const locale = stored.get(id) ?? userLocale(null);
    const bucket = grouped.get(locale);
    if (bucket) bucket.push(id);
    else grouped.set(locale, [id]);
  }

  return LOCALES.filter((locale) => grouped.has(locale)).map((locale) => ({
    locale,
    userIds: grouped.get(locale)!,
  }));
}

/**
 * Debug sink for delivery attempts, off unless `PUSH_DELIVERY_LOG` names a file.
 *
 * A web push is encrypted end to end with the browser's own keys, so what was actually sent is
 * unreadable from outside — which makes "the alert arrived in the wrong language" impossible to
 * confirm either from a test or from a laptop on the LAN floor. One JSON line per attempt is the
 * cheapest way to see it. Never throws: this is diagnostics, and a full disk must not silence a
 * notification.
 */
function recordDeliveryAttempt(endpoint: string, userId: string, payload: PushPayload) {
  const file = process.env.PUSH_DELIVERY_LOG;
  if (!file) return;
  try {
    fs.appendFileSync(file, `${JSON.stringify({ at: new Date().toISOString(), endpoint, userId, payload })}\n`);
  } catch {
    // ignored on purpose
  }
}

/** Best-effort web push to every subscription belonging to the given users. */
export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  if (!ensureConfigured() || userIds.length === 0) return;

  const subs = await prisma.pushSubscription.findMany({
    where: { userId: { in: userIds } },
  });
  if (subs.length === 0) return;

  const data = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (sub) => {
      recordDeliveryAttempt(sub.endpoint, sub.userId, payload);
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          data
        );
      } catch (err: any) {
        // 404/410 mean the subscription is dead — prune it.
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          console.warn("[Push] send failed:", err?.statusCode || err?.message);
        }
      }
    })
  );
}

/** One language's worth of a notification: who gets it, and what it says to them. */
export interface PushBatch extends PushAudience {
  payload: PushPayload;
}

/** Send a batch per language. Each group only ever sees the payload composed for its own locale. */
export async function sendPushBatches(batches: PushBatch[]) {
  for (const batch of batches) {
    await sendPushToUsers(batch.userIds, batch.payload);
  }
}
