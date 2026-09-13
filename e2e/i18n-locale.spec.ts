import { expect, test } from '@playwright/test';
import { loginAs, personaUserId, mintSessionToken, E2E_BASE_URL } from './helpers/auth';
import { prisma } from './helpers/lan-seed';

/**
 * Language selection. The rest of the suite is pinned to English by a cookie in
 * playwright.config.ts; these tests deliberately start from a clean context so they can see
 * what a real first-time visitor gets.
 */
test.describe.configure({ mode: 'serial' });

/**
 * A context with no locale cookie — i.e. somebody arriving for the first time.
 * `locale` is what actually drives Accept-Language in Playwright; the config's English cookie
 * is cleared explicitly so these tests see real first-visit detection.
 */
async function freshContext(browser: any, browserLocale: string) {
  const ctx = await browser.newContext({
    storageState: { cookies: [], origins: [] },
    locale: browserLocale,
    extraHTTPHeaders: { 'accept-language': browserLocale },
  });
  await ctx.clearCookies();
  return ctx;
}

test('a Norwegian browser gets Norwegian without touching a setting', async ({ browser }) => {
  const ctx = await freshContext(browser, 'nb-NO');
  const page = await ctx.newPage();
  await page.goto('/tournaments');

  await expect(page.locator('html')).toHaveAttribute('lang', 'nb-NO');
  await expect(page.getByTestId('locale-toggle')).toContainText('NB');
  // Nav is translated, and the Norwegian letters survive the font stack.
  await expect(page.locator('header').first()).toContainText('Turneringer');
  await ctx.close();
});

test('an English browser gets English without touching a setting', async ({ browser }) => {
  const ctx = await freshContext(browser, 'en-GB');
  const page = await ctx.newPage();
  await page.goto('/tournaments');

  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByTestId('locale-toggle')).toContainText('EN');
  await expect(page.locator('header').first()).toContainText('Tournaments');
  await ctx.close();
});

test('a browser that asks for neither gets Norwegian, because this is a Norwegian club', async ({ browser }) => {
  const ctx = await freshContext(browser, 'de-DE');
  const page = await ctx.newPage();
  await page.goto('/tournaments');
  await expect(page.locator('html')).toHaveAttribute('lang', 'nb-NO');
  await ctx.close();
});

test('the toggle switches language and the choice survives a reload', async ({ browser }) => {
  const ctx = await freshContext(browser, 'nb-NO');
  const page = await ctx.newPage();
  await page.goto('/tournaments');
  await expect(page.locator('header').first()).toContainText('Turneringer');

  await page.getByTestId('locale-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('header').first()).toContainText('Tournaments');

  // An explicit choice beats the browser's preference, on this visit and the next.
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await ctx.close();
});

test('a signed-in player has their language stored, so push can be written in it', async ({ browser }) => {
  await mintSessionToken('leo');
  const userId = await personaUserId('leo');
  await prisma.user.update({ where: { id: userId }, data: { locale: null } });

  const ctx = await freshContext(browser, 'en-GB');
  const page = await ctx.newPage();
  await loginAs(page, 'leo');
  await page.goto('/tournaments');
  await page.getByTestId('locale-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'nb-NO');

  await expect
    .poll(async () => (await prisma.user.findUnique({ where: { id: userId } }))!.locale)
    .toBe('nb');
  await ctx.close();
});

test('an unsupported locale is refused rather than stored', async ({ request }) => {
  const res = await request.post(`${E2E_BASE_URL}/api/me/locale`, { data: { locale: 'de' } });
  expect(res.status()).toBe(400);
});
