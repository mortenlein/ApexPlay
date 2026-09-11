import { expect, test, type Page } from '@playwright/test';
import { disposeApiContexts } from './helpers/api';
import {
  createRosterTeams,
  createTournament,
  plantTeamSecrets,
  scoreMatchAsAdmin,
  seedPlayedBracket,
} from './helpers/lan-seed';

/**
 * The OBS browser sources: `/bracket/[id]/overlay` and `/bracket/[id]/roster`.
 *
 * These are the only pages in the app whose "user" is a compositor — no chrome, a keyable
 * background, and they have to keep themselves current while nobody is looking at a browser.
 */
test.describe.configure({ mode: 'serial' });
test.afterEach(disposeApiContexts);

const streamNode = (page: Page, matchId: string) => page.locator(`.react-flow__node[data-id="${matchId}"]`);
/** The big score readouts inside an overlay node, home first. */
const streamScores = (page: Page, matchId: string) => streamNode(page, matchId).locator('span.text-3xl');

test('overlay renders the bracket chrome-free with stage labels, names, seats and scores', async ({ page }) => {
  const { tournamentId, matches, playedMatches } = await seedPlayedBracket({ teams: 8, completed: 2 });

  await page.goto(`/bracket/${tournamentId}/overlay`);

  await expect(page.locator('.react-flow__node')).toHaveCount(matches.length);
  await expect(page.getByText('Grand Finals')).toBeVisible();
  await expect(page.getByText('Semi-Finals').first()).toBeVisible();
  await expect(page.getByText('Quarter-Finals').first()).toBeVisible();

  // Seats and names ride along, so a caster can name who is playing and where they sit.
  const played = streamNode(page, playedMatches[0].id);
  await expect(played).toContainText('Seed 1');
  await expect(played).toContainText('S01:Player 1');
  await expect(streamScores(page, playedMatches[0].id).nth(0)).toHaveText('1');
  await expect(streamScores(page, playedMatches[0].id).nth(1)).toHaveText('0');

  // Chrome-free: NavigationWrapper skips the header on /bracket/* (OBS must not capture nav).
  await expect(page.locator('header')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Tournaments' })).toHaveCount(0);
});

// BUG: the stream overlay never marks the live match in a best-of-1 event, and mislabels
// everything that has not started. The status footer — the only place the overlay prints
// FINAL / LIVE (with the pulsing dot) — is rendered only when
// `data.bestOf > 1 || isCenter || isThirdPlace` (src/app/bracket/[id]/overlay/page.tsx:118),
// so in a BO1 bracket (the default: `bestOf: 1` unless bo3LastRounds is set) every match except
// the grand final shows scores with no state at all: the observed node text for a COMPLETED
// quarter-final is "Quarter-FinalsSeed 1S01:Player 11Seed 8S08:Player 80" — no FINAL, and the
// LIVE match renders identically.
// And where the footer IS rendered, PENDING is printed as "IN PROGRESS"
// (same file, line 122: `status === 'COMPLETED' ? 'FINAL' : status === 'LIVE' ? … : 'IN PROGRESS'`),
// so an unplayed grand final goes out on stream as in progress.
test.fixme('overlay marks the live match and never calls a pending match in progress', async ({ page }) => {
  const { tournamentId, matches, playedMatches, liveMatch } = await seedPlayedBracket({ teams: 8, completed: 2 });
  const grandFinal = matches.find((m) => m.round === 3)!;
  expect(grandFinal.status).toBe('PENDING');

  await page.goto(`/bracket/${tournamentId}/overlay`);

  await expect(streamNode(page, liveMatch!.id)).toContainText('LIVE');
  await expect(streamNode(page, playedMatches[0].id)).toContainText('FINAL');
  await expect(streamNode(page, grandFinal.id)).not.toContainText('IN PROGRESS');
});

test('overlay honours its chroma and compact query params', async ({ page }) => {
  const { tournamentId } = await seedPlayedBracket({ teams: 4, completed: 1 });

  // Default: transparent, so OBS composites the bracket over the game feed.
  await page.goto(`/bracket/${tournamentId}/overlay`);
  await expect(page.locator('.react-flow__node').first()).toBeVisible();
  const transparent = await page.evaluate(() => ({
    body: window.getComputedStyle(document.body).backgroundColor,
    html: window.getComputedStyle(document.documentElement).backgroundColor,
  }));
  expect(transparent.body).toBe('rgba(0, 0, 0, 0)');
  expect(transparent.html).toBe('rgba(0, 0, 0, 0)');

  // A chroma key paints html+body that colour for a colour-key filter.
  await page.goto(`/bracket/${tournamentId}/overlay?chroma=%2300ff00`);
  await expect(page.locator('.react-flow__node').first()).toBeVisible();
  const keyed = await page.evaluate(() => ({
    body: window.getComputedStyle(document.body).backgroundColor,
    html: window.getComputedStyle(document.documentElement).backgroundColor,
    wrapper: window.getComputedStyle(document.querySelector('div.w-screen.h-screen') as Element).backgroundColor,
  }));
  expect(keyed.body).toBe('rgb(0, 255, 0)');
  expect(keyed.html).toBe('rgb(0, 255, 0)');
  expect(keyed.wrapper).toBe('rgb(0, 255, 0)');

  // compact=true scales the whole canvas down for a corner source.
  await page.goto(`/bracket/${tournamentId}/overlay?compact=true`);
  await expect(page.locator('.react-flow__node').first()).toBeVisible();
  const transform = await page.evaluate(
    () => window.getComputedStyle(document.querySelector('div.w-screen.h-screen') as Element).transform
  );
  expect(transform).toContain('matrix(0.75');
});

test('overlay picks up a score change over the live stream', async ({ page }) => {
  const { tournamentId, liveMatch } = await seedPlayedBracket({ teams: 8, completed: 2 });

  await page.goto(`/bracket/${tournamentId}/overlay`);
  await expect(streamScores(page, liveMatch!.id).nth(0)).toHaveText('0');

  await page.evaluate(() => {
    (window as any).__stillTheSameDocument = true;
  });

  await scoreMatchAsAdmin(liveMatch!.id, 16, 14);

  // No reload, no polling interval to wait out: the SSE frame repaints the node.
  await expect(streamScores(page, liveMatch!.id).nth(0)).toHaveText('16', { timeout: 35000 });
  await expect(streamScores(page, liveMatch!.id).nth(1)).toHaveText('14');
  expect(await page.evaluate(() => (window as any).__stillTheSameDocument)).toBe(true);
});

test('overlay states plainly when a tournament has no bracket yet', async ({ page }) => {
  const empty = await createTournament({ name: `Overlay Empty ${Date.now().toString(36)}`, teamSize: 1 });

  await page.goto(`/bracket/${empty.id}/overlay`);

  await expect(page.getByText('No match data available for this tournament')).toBeVisible();
});

test('roster board shows every team with its players and seats', async ({ page }) => {
  const tournament = await createTournament({ name: `Roster Board ${Date.now().toString(36)}`, teamSize: 2 });
  await createRosterTeams(tournament.id, 8, 2);
  const secrets = await plantTeamSecrets(tournament.id);

  await page.goto(`/bracket/${tournament.id}/roster?chroma=%23001122`);

  for (const seed of [1, 5, 8]) {
    const card = page.locator('div.rounded-3xl').filter({ hasText: `Roster Squad ${seed}` });
    await expect(card).toContainText(`Seed #${seed}`);
    await expect(card).toContainText(`Roster Player ${seed}-1`);
    await expect(card).toContainText(`Roster Player ${seed}-2`);
    await expect(card).toContainText(`R${String(seed).padStart(2, '0')}-1`);
  }
  await expect(page.locator('div.rounded-3xl')).toHaveCount(8);

  const background = await page.evaluate(
    () => window.getComputedStyle(document.querySelector('div.w-screen.h-screen') as Element).backgroundColor
  );
  expect(background).toBe('rgb(0, 17, 34)');

  // An OBS source is a public screen: no invite codes or steamIds may reach it.
  const html = await page.content();
  for (const secret of secrets) {
    expect(html.includes(secret), `${secret} leaked onto the roster board`).toBe(false);
  }
});

test('roster board lays 16 teams out inside 1920x1080 without sideways scroll', async ({ page }) => {
  const tournament = await createTournament({ name: `Roster Wide ${Date.now().toString(36)}`, teamSize: 2 });
  await createRosterTeams(tournament.id, 16, 2);
  await page.setViewportSize({ width: 1920, height: 1080 });

  await page.goto(`/bracket/${tournament.id}/roster`);
  await expect(page.locator('div.rounded-3xl')).toHaveCount(16);

  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
  }));
  expect(metrics.scrollWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.clientWidth);
});

// BUG: the roster board silently loses teams once there are more than 12. The grid is hardcoded
// to four columns (`grid grid-cols-4 gap-8`, src/app/bracket/[id]/roster/page.tsx:62) inside a
// `w-screen h-screen overflow-hidden p-12` frame (line 58), so a 16-team LAN spills into a
// fourth row that is clipped away — and because the frame cannot scroll (and an OBS browser
// source has nobody to scroll it), those teams are simply not on the stream. Measured at
// 1920x1080 with 16 teams of 2 players:
//   Roster Squad 13-16 have bottom=1280 against an innerHeight of 1080.
// The width is fine (no horizontal overflow — the previous test passes), so the fix is a
// responsive/auto-fitting grid or pagination, not a wider container.
test.fixme('every team on a 16-team roster board is actually on screen', async ({ page }) => {
  const tournament = await createTournament({ name: `Roster Fold ${Date.now().toString(36)}`, teamSize: 2 });
  await createRosterTeams(tournament.id, 16, 2);
  await page.setViewportSize({ width: 1920, height: 1080 });

  await page.goto(`/bracket/${tournament.id}/roster`);
  await expect(page.locator('div.rounded-3xl')).toHaveCount(16);

  const offScreen = await page.evaluate(() =>
    Array.from(document.querySelectorAll('div.rounded-3xl'))
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const name = el.querySelector('h2')?.textContent || '?';
        return { name, bottom: Math.round(rect.bottom), right: Math.round(rect.right) };
      })
      .filter((box) => box.bottom > window.innerHeight || box.right > window.innerWidth)
  );

  expect(offScreen, `clipped by the h-screen/overflow-hidden board: ${JSON.stringify(offScreen)}`).toEqual([]);
});
