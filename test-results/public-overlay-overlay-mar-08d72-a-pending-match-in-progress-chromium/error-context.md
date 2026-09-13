# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: public-overlay.spec.ts >> overlay marks the live match and never calls a pending match in progress
- Location: e2e/public-overlay.spec.ts:56:5

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('.react-flow__node[data-id="5bccafe7-4de2-4f00-b3dc-4e50a21fcabc"]')
Expected substring: "Live"
Received string:    "Quarter-FinalsSeed 2S02:Player 20Seed 7S07:Player 70BEST OF 1LIVE"
Timeout: 20000ms

Call log:
  - Expect "toContainText" locator('.react-flow__node[data-id="5bccafe7-4de2-4f00-b3dc-4e50a21fcabc"]') with timeout 20000ms
  - waiting for locator('.react-flow__node[data-id="5bccafe7-4de2-4f00-b3dc-4e50a21fcabc"]')
    40 × locator resolved to <div tabindex="0" role="button" aria-describedby="react-flow__node-desc-1" data-id="5bccafe7-4de2-4f00-b3dc-4e50a21fcabc" data-testid="rf__node-5bccafe7-4de2-4f00-b3dc-4e50a21fcabc" class="react-flow__node react-flow__node-streamMatch nopan selectable">…</div>
       - unexpected value "Quarter-FinalsSeed 2S02:Player 20Seed 7S07:Player 70BEST OF 1LIVE"

```

```yaml
- button "Quarter-Finals Seed 2 S02:Player 2 0 Seed 7 S07:Player 7 0 BEST OF 1 LIVE"
```

# Test source

```ts
  1   | import { expect, test, type Page } from '@playwright/test';
  2   | import { disposeApiContexts } from './helpers/api';
  3   | import {
  4   |   createRosterTeams,
  5   |   createTournament,
  6   |   plantTeamSecrets,
  7   |   scoreMatchAsAdmin,
  8   |   seedPlayedBracket,
  9   | } from './helpers/lan-seed';
  10  | 
  11  | /**
  12  |  * The OBS browser sources: `/bracket/[id]/overlay` and `/bracket/[id]/roster`.
  13  |  *
  14  |  * These are the only pages in the app whose "user" is a compositor — no chrome, a keyable
  15  |  * background, and they have to keep themselves current while nobody is looking at a browser.
  16  |  */
  17  | test.describe.configure({ mode: 'serial' });
  18  | test.afterEach(disposeApiContexts);
  19  | 
  20  | const streamNode = (page: Page, matchId: string) => page.locator(`.react-flow__node[data-id="${matchId}"]`);
  21  | /** The big score readouts inside an overlay node, home first. */
  22  | const streamScores = (page: Page, matchId: string) => streamNode(page, matchId).locator('span.text-3xl');
  23  | 
  24  | test('overlay renders the bracket chrome-free with stage labels, names, seats and scores', async ({ page }) => {
  25  |   const { tournamentId, matches, playedMatches } = await seedPlayedBracket({ teams: 8, completed: 2 });
  26  | 
  27  |   await page.goto(`/bracket/${tournamentId}/overlay`);
  28  | 
  29  |   await expect(page.locator('.react-flow__node')).toHaveCount(matches.length);
  30  |   await expect(page.getByText('Grand Finals')).toBeVisible();
  31  |   await expect(page.getByText('Semi-Finals').first()).toBeVisible();
  32  |   await expect(page.getByText('Quarter-Finals').first()).toBeVisible();
  33  | 
  34  |   // Seats and names ride along, so a caster can name who is playing and where they sit.
  35  |   const played = streamNode(page, playedMatches[0].id);
  36  |   await expect(played).toContainText('Seed 1');
  37  |   await expect(played).toContainText('S01:Player 1');
  38  |   await expect(streamScores(page, playedMatches[0].id).nth(0)).toHaveText('1');
  39  |   await expect(streamScores(page, playedMatches[0].id).nth(1)).toHaveText('0');
  40  | 
  41  |   // Chrome-free: NavigationWrapper skips the header on /bracket/* (OBS must not capture nav).
  42  |   await expect(page.locator('header')).toHaveCount(0);
  43  |   await expect(page.getByRole('link', { name: 'Tournaments' })).toHaveCount(0);
  44  | });
  45  | 
  46  | // Regression: the stream overlay never marked the live match in a best-of-1 event, and
  47  | // mislabelled everything that had not started. The status footer — the only place the overlay
  48  | // prints FINAL / LIVE (with the pulsing dot) — was rendered only when
  49  | // `data.bestOf > 1 || isCenter || isThirdPlace`, so in a BO1 bracket (the default: `bestOf: 1`
  50  | // unless bo3LastRounds is set) every match except the grand final showed scores with no state at
  51  | // all: the observed node text for a COMPLETED quarter-final was
  52  | // "Quarter-FinalsSeed 1S01:Player 11Seed 8S08:Player 80" — no FINAL, and the LIVE match rendered
  53  | // identically. And where the footer WAS rendered, PENDING was printed as "IN PROGRESS", so an
  54  | // unplayed grand final went out on stream as in progress. The footer is now unconditional and
  55  | // its state comes from the shared helpers in src/lib/match-status.ts.
  56  | test('overlay marks the live match and never calls a pending match in progress', async ({ page }) => {
  57  |   const { tournamentId, matches, playedMatches, liveMatch } = await seedPlayedBracket({ teams: 8, completed: 2 });
  58  |   const grandFinal = matches.find((m) => m.round === 3)!;
  59  |   expect(grandFinal.status).toBe('PENDING');
  60  | 
  61  |   await page.goto(`/bracket/${tournamentId}/overlay`);
  62  | 
> 63  |   await expect(streamNode(page, liveMatch!.id)).toContainText('Live');
      |                                                 ^ Error: expect(locator).toContainText(expected) failed
  64  |   await expect(streamNode(page, playedMatches[0].id)).toContainText('Final');
  65  |   await expect(streamNode(page, grandFinal.id)).not.toContainText('IN PROGRESS');
  66  | });
  67  | 
  68  | test('overlay honours its chroma and compact query params', async ({ page }) => {
  69  |   const { tournamentId } = await seedPlayedBracket({ teams: 4, completed: 1 });
  70  | 
  71  |   // Default: transparent, so OBS composites the bracket over the game feed.
  72  |   await page.goto(`/bracket/${tournamentId}/overlay`);
  73  |   await expect(page.locator('.react-flow__node').first()).toBeVisible();
  74  |   const transparent = await page.evaluate(() => ({
  75  |     body: window.getComputedStyle(document.body).backgroundColor,
  76  |     html: window.getComputedStyle(document.documentElement).backgroundColor,
  77  |   }));
  78  |   expect(transparent.body).toBe('rgba(0, 0, 0, 0)');
  79  |   expect(transparent.html).toBe('rgba(0, 0, 0, 0)');
  80  | 
  81  |   // A chroma key paints html+body that colour for a colour-key filter.
  82  |   await page.goto(`/bracket/${tournamentId}/overlay?chroma=%2300ff00`);
  83  |   await expect(page.locator('.react-flow__node').first()).toBeVisible();
  84  |   const keyed = await page.evaluate(() => ({
  85  |     body: window.getComputedStyle(document.body).backgroundColor,
  86  |     html: window.getComputedStyle(document.documentElement).backgroundColor,
  87  |     wrapper: window.getComputedStyle(document.querySelector('div.w-screen.h-screen') as Element).backgroundColor,
  88  |   }));
  89  |   expect(keyed.body).toBe('rgb(0, 255, 0)');
  90  |   expect(keyed.html).toBe('rgb(0, 255, 0)');
  91  |   expect(keyed.wrapper).toBe('rgb(0, 255, 0)');
  92  | 
  93  |   // compact=true scales the whole canvas down for a corner source.
  94  |   await page.goto(`/bracket/${tournamentId}/overlay?compact=true`);
  95  |   await expect(page.locator('.react-flow__node').first()).toBeVisible();
  96  |   const transform = await page.evaluate(
  97  |     () => window.getComputedStyle(document.querySelector('div.w-screen.h-screen') as Element).transform
  98  |   );
  99  |   expect(transform).toContain('matrix(0.75');
  100 | });
  101 | 
  102 | test('overlay picks up a score change over the live stream', async ({ page }) => {
  103 |   const { tournamentId, liveMatch } = await seedPlayedBracket({ teams: 8, completed: 2 });
  104 | 
  105 |   await page.goto(`/bracket/${tournamentId}/overlay`);
  106 |   await expect(streamScores(page, liveMatch!.id).nth(0)).toHaveText('0');
  107 | 
  108 |   await page.evaluate(() => {
  109 |     (window as any).__stillTheSameDocument = true;
  110 |   });
  111 | 
  112 |   await scoreMatchAsAdmin(liveMatch!.id, 16, 14);
  113 | 
  114 |   // No reload, no polling interval to wait out: the SSE frame repaints the node.
  115 |   await expect(streamScores(page, liveMatch!.id).nth(0)).toHaveText('16', { timeout: 35000 });
  116 |   await expect(streamScores(page, liveMatch!.id).nth(1)).toHaveText('14');
  117 |   expect(await page.evaluate(() => (window as any).__stillTheSameDocument)).toBe(true);
  118 | });
  119 | 
  120 | test('overlay states plainly when a tournament has no bracket yet', async ({ page }) => {
  121 |   const empty = await createTournament({ name: `Overlay Empty ${Date.now().toString(36)}`, teamSize: 1 });
  122 | 
  123 |   await page.goto(`/bracket/${empty.id}/overlay`);
  124 | 
  125 |   await expect(page.getByText('No match data available for this tournament')).toBeVisible();
  126 | });
  127 | 
  128 | test('roster board shows every team with its players and seats', async ({ page }) => {
  129 |   const tournament = await createTournament({ name: `Roster Board ${Date.now().toString(36)}`, teamSize: 2 });
  130 |   await createRosterTeams(tournament.id, 8, 2);
  131 |   const secrets = await plantTeamSecrets(tournament.id);
  132 | 
  133 |   await page.goto(`/bracket/${tournament.id}/roster?chroma=%23001122`);
  134 | 
  135 |   for (const seed of [1, 5, 8]) {
  136 |     const card = page.locator('div.rounded-3xl').filter({ hasText: `Roster Squad ${seed}` });
  137 |     await expect(card).toContainText(`Seed #${seed}`);
  138 |     await expect(card).toContainText(`Roster Player ${seed}-1`);
  139 |     await expect(card).toContainText(`Roster Player ${seed}-2`);
  140 |     await expect(card).toContainText(`R${String(seed).padStart(2, '0')}-1`);
  141 |   }
  142 |   await expect(page.locator('div.rounded-3xl')).toHaveCount(8);
  143 | 
  144 |   const background = await page.evaluate(
  145 |     () => window.getComputedStyle(document.querySelector('div.w-screen.h-screen') as Element).backgroundColor
  146 |   );
  147 |   expect(background).toBe('rgb(0, 17, 34)');
  148 | 
  149 |   // An OBS source is a public screen: no invite codes or steamIds may reach it.
  150 |   const html = await page.content();
  151 |   for (const secret of secrets) {
  152 |     expect(html.includes(secret), `${secret} leaked onto the roster board`).toBe(false);
  153 |   }
  154 | });
  155 | 
  156 | test('roster board lays 16 teams out inside 1920x1080 without sideways scroll', async ({ page }) => {
  157 |   const tournament = await createTournament({ name: `Roster Wide ${Date.now().toString(36)}`, teamSize: 2 });
  158 |   await createRosterTeams(tournament.id, 16, 2);
  159 |   await page.setViewportSize({ width: 1920, height: 1080 });
  160 | 
  161 |   await page.goto(`/bracket/${tournament.id}/roster`);
  162 |   await expect(page.locator('div.rounded-3xl')).toHaveCount(16);
  163 | 
```