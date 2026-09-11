import { request as playwrightRequest, type APIRequestContext } from '@playwright/test';
import { E2E_BASE_URL, mintSessionToken, type Persona } from './auth';

/**
 * API-level personas.
 *
 * Most of what a LAN depends on is a route contract, not a screen: who may read an invite code,
 * what a bye row looks like, where a winner lands. Driving those through a bare
 * `APIRequestContext` carrying the minted session cookie is an order of magnitude faster than
 * booting a browser page per assertion, and it lets one test hold several identities at once
 * (leo + sam + an anonymous caller) without juggling browser contexts.
 *
 * Contexts are tracked so a spec can dispose them all in one `afterEach`.
 */
const openContexts: APIRequestContext[] = [];

/** A request context authenticated as `persona` (session cookie sent on every request). */
export async function apiAs(persona: Persona): Promise<APIRequestContext> {
  // Mint *now*: the destructive seeds recreate User rows, so a token has to be newer than the
  // most recent seed or its `dbId` points at a deleted row.
  const token = await mintSessionToken(persona);
  const context = await playwrightRequest.newContext({
    baseURL: E2E_BASE_URL,
    extraHTTPHeaders: { cookie: `next-auth.session-token=${token}` },
  });
  openContexts.push(context);
  return context;
}

/** A request context with no session at all — the public/anonymous caller. */
export async function apiAnon(): Promise<APIRequestContext> {
  const context = await playwrightRequest.newContext({ baseURL: E2E_BASE_URL });
  openContexts.push(context);
  return context;
}

/** Dispose every context handed out by `apiAs`/`apiAnon`. Wire into `test.afterEach`. */
export async function disposeApiContexts() {
  while (openContexts.length) {
    await openContexts.pop()!.dispose();
  }
}

/** Parse a JSON response, failing with the raw body when the shape isn't what we expect. */
export async function json<T = any>(response: { json(): Promise<any>; text(): Promise<string>; status(): number }): Promise<T> {
  const raw = await response.text();
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`Expected JSON (status ${response.status()}), got: ${raw.slice(0, 300)}`);
  }
}

/** A minimal valid 1x1 PNG, for exercising the upload route's auth gate with a real file. */
export const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64'
);
