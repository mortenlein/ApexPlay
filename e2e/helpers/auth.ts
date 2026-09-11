import type { Page } from '@playwright/test';
import { encode } from 'next-auth/jwt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type Persona = 'marcus' | 'leo' | 'sam' | 'chloe' | 'toby' | 'mia';

export const PERSONAS: Record<Persona, { steamId: string; email: string; name: string }> = {
  // marcus' steamid is in ADMIN_STEAMIDS (playwright.config.ts) → admin.
  marcus: { steamId: '76561198000000001', email: 'mock+marcus@apexplay.local', name: 'Marcus' },
  leo: { steamId: '76561198000000002', email: 'mock+leo@apexplay.local', name: 'Leo' },
  sam: { steamId: '76561198000000003', email: 'mock+sam@apexplay.local', name: 'Sam' },
  chloe: { steamId: '76561198000000004', email: 'mock+chloe@apexplay.local', name: 'Chloe' },
  toby: { steamId: '76561198000000005', email: 'mock+toby@apexplay.local', name: 'Toby' },
  // mia's steamid is in MARSHAL_STEAMIDS (playwright.config.ts) → floor staff, not admin.
  mia: { steamId: '76561198000000006', email: 'mock+mia@apexplay.local', name: 'Mia' },
};

/** Must match the e2e server's NEXTAUTH_SECRET (playwright.config.ts). Hardcoded rather than
 *  read from process.env, which isn't reliably propagated into Playwright worker processes. */
export const E2E_NEXTAUTH_SECRET = 'test-secret';
export const E2E_BASE_URL = 'http://127.0.0.1:4101';

/**
 * Upserts the persona's user row and mints the NextAuth session-token JWT the server will
 * accept for them. Call this AFTER seeding, because the destructive seeds drop `User` rows and
 * a token minted earlier would carry a dead `dbId`.
 */
export async function mintSessionToken(persona: Persona): Promise<string> {
  const p = PERSONAS[persona];
  const dbUser = await prisma.user.upsert({
    where: { email: p.email },
    update: { steamId: p.steamId, name: p.name },
    create: { email: p.email, steamId: p.steamId, name: p.name },
  });

  return encode({
    token: { steamId: p.steamId, dbId: dbUser.id, name: p.name, email: p.email },
    secret: E2E_NEXTAUTH_SECRET,
  });
}

/** The DB user id behind a persona (after `mintSessionToken`/`loginAs` has created them). */
export async function personaUserId(persona: Persona): Promise<string> {
  const user = await prisma.user.findUnique({ where: { email: PERSONAS[persona].email } });
  if (!user) throw new Error(`personaUserId(${persona}): user row missing — mint a session first`);
  return user.id;
}

/**
 * Log in by minting a NextAuth session cookie directly (reliable in headless, unlike the
 * mock-credentials UI flow which is flaky on CSRF). Mirrors what the jwt/session callbacks
 * produce: steamId drives the role; dbId (looked up from the seeded user) backs session.user.id.
 */
export async function loginAs(page: Page, persona: Persona) {
  // Ensure the user exists (the mock-credentials login used to upsert it on sign-in).
  const token = await mintSessionToken(persona);

  // Set via `url` (not domain/path) — robust for the 127.0.0.1 IP host.
  await page.context().addCookies([
    { name: 'next-auth.session-token', value: token, url: 'http://127.0.0.1:4101' },
  ]);

  // Fail fast (and informatively) if the server doesn't accept the session.
  const res = await page.request.get('http://127.0.0.1:4101/api/auth/session');
  const body = await res.text();
  let session: any = {};
  try {
    session = JSON.parse(body);
  } catch {
    /* leave session empty */
  }
  if (!session?.user) {
    throw new Error(
      `loginAs(${persona}): secret="${E2E_NEXTAUTH_SECRET}" status=${res.status()} bodyLen=${body.length} body="${body.slice(0, 160)}"`
    );
  }
}
