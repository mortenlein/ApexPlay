import { expect, test } from '@playwright/test';
import { disposeApiContexts } from './helpers/api';
import { createSeededTeams, createTournament } from './helpers/lan-seed';
import { loginAs } from './helpers/auth';

/**
 * The front door. Everything a player does starts at `/` or `/login`, and the only thing the
 * landing page has to get right is "what am I, and where do I go next" — one call to action per
 * role, and the tournament list underneath it.
 */
test.describe.configure({ mode: 'serial' });
test.afterEach(disposeApiContexts);

test('an anonymous visitor is offered Steam sign-in and can see what is running', async ({ page }) => {
  const tournament = await createTournament({ name: 'Landing Anon Cup', teamSize: 1 });
  await createSeededTeams(tournament.id, 2);

  await page.goto('/');

  await expect(page.getByTestId('landing-cta-login')).toContainText('Sign in with Steam');
  // No player or organizer entry points for somebody with no session.
  await expect(page.getByTestId('landing-cta-dashboard')).toBeHidden();
  await expect(page.getByTestId('landing-cta-organizer')).toBeHidden();

  // The list is public: a player checks the LAN schedule before they log in.
  const card = page.getByRole('listitem').filter({ hasText: 'Landing Anon Cup' });
  await expect(card).toContainText('Single elim');
  await expect(card).toContainText('2 teams');
  await expect(card.getByRole('link')).toHaveAttribute('href', `/tournaments/${tournament.id}`);
});

test('a signed-in player is sent to their desk, and offered no organizer tools', async ({ page }) => {
  await loginAs(page, 'leo');
  await page.goto('/');

  await expect(page.getByTestId('landing-cta-dashboard')).toContainText('My dashboard');
  await expect(page.getByTestId('landing-cta-login')).toBeHidden();
  // Leo's steamid is not on ADMIN_STEAMIDS — the organizer door must not even be visible.
  await expect(page.getByTestId('landing-cta-organizer')).toBeHidden();

  await page.getByTestId('landing-cta-dashboard').click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('an admin gets both doors: their own desk and the organizer workspace', async ({ page }) => {
  await loginAs(page, 'marcus');
  await page.goto('/');

  await expect(page.getByTestId('landing-cta-dashboard')).toContainText('My dashboard');
  await expect(page.getByTestId('landing-cta-organizer')).toContainText('Organizer');
});

test('the login screen offers Steam plus the mock personas, and keeps its callbackUrl', async ({ page }) => {
  await page.goto('/login?callbackUrl=%2Fadmin');

  await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
  await expect(page.getByTestId('steam-login')).toContainText('Sign in through Steam');
  // Mock mode is on for the e2e run, so every persona has a one-click door.
  for (const persona of ['marcus', 'leo', 'sam', 'chloe', 'toby']) {
    await expect(page.getByTestId(`mock-persona-${persona}`)).toBeVisible();
  }

  // The callbackUrl is read, not ignored: a staff destination re-labels the whole screen.
  await page.goto('/login?callbackUrl=%2Fmarshal%2Fdashboard');
  await expect(page.getByRole('heading', { name: 'Staff Access' })).toBeVisible();
});

test('a player who signs in for /admin is bounced home rather than looped back to login', async ({ page }) => {
  // BUG: signing in at /login?callbackUrl=/admin puts a player in an endless loop.
  //
  // src/lib/route-auth.ts:66-69 is explicit about the intent — "Signed in but not an admin →
  // send home (no point looping back to login)" — but src/middleware.ts:22-26 runs first on
  // every /admin/* and /marshal/* request and redirects *any* non-admin token, signed in or
  // not, straight back to /login?callbackUrl=<pathname>. So requireAdminPage's redirect('/')
  // branch is unreachable for exactly the visitors it was written for, and Leo can click his
  // persona on the login screen forever: /login → /admin → /login → …, with nothing on the
  // page saying he simply is not an organizer.
  //
  // Observed on this port: session is established (role "player", /api/auth/session returns
  // Leo) and page.goto('/admin') still lands on /login?callbackUrl=%2Fadmin.
  await page.goto('/login?callbackUrl=%2Fadmin');
  await page.getByTestId('mock-persona-leo').click();

  await expect(page).toHaveURL(new RegExp(`^${new URL(page.url()).origin}/$`));
  await expect(page.getByTestId('landing-cta-dashboard')).toBeVisible();
  await expect(page.getByTestId('landing-cta-organizer')).toBeHidden();
});

test('signing in as a persona from the login screen really does sign you in', async ({ page }) => {
  // The persona buttons are the e2e/on-site shortcut around Steam OpenID; a player-facing
  // screen that "signs you in" without a session would make every later assertion a lie.
  await page.goto('/login?callbackUrl=%2Fdashboard');
  await page.getByTestId('mock-persona-leo').click();

  await expect(page).toHaveURL(/\/dashboard$/);
  const session = await (await page.request.get('/api/auth/session')).json();
  expect(session.user).toMatchObject({ name: 'Leo', role: 'player' });
  await expect(page.getByRole('heading', { name: /Welcome back, Leo/i })).toBeVisible();
});
