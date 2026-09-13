# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: lan-personas.spec.ts >> Marcus can start a match and Uncle Dave sees seats plus notifications
- Location: e2e/lan-personas.spec.ts:13:5

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByTestId('match-card-49ee23eb-aae6-4805-b4ca-f2b39b6206e7')
Expected pattern: /READY/i
Received string:  "FinalCalledTeam A0Team B0Best of 1 Edit"
Timeout: 20000ms

Call log:
  - Expect "toContainText" getByTestId('match-card-49ee23eb-aae6-4805-b4ca-f2b39b6206e7') with timeout 20000ms
  - waiting for getByTestId('match-card-49ee23eb-aae6-4805-b4ca-f2b39b6206e7')
    44 × locator resolved to <button data-testid="match-card-49ee23eb-aae6-4805-b4ca-f2b39b6206e7" class="group flex flex-col overflow-hidden rounded-lg border text-left transition-all hover:bg-[var(--mds-card-hover)] border-[var(--mds-border)] hover:border-[var(--mds-action)]/40">…</button>
       - unexpected value "FinalCalledTeam A0Team B0Best of 1 Edit"

```

```yaml
- button "Final Called Team A 0 Team B 0 Best of 1 Edit":
  - text: Final Called Team A 0 Team B 0 Best of 1
  - img
  - text: Edit
```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test';
  2  | import { seedEmptyTournament, seedLanScenario } from './helpers/seed';
  3  | import { loginAs } from './helpers/auth';
  4  | 
  5  | test.describe.configure({ mode: 'serial' });
  6  | 
  7  | async function loginAsAdmin(page: import('@playwright/test').Page) {
  8  |   await loginAs(page, 'marcus');
  9  |   await page.goto('/admin');
  10 |   await expect(page).toHaveURL(/\/admin$/);
  11 | }
  12 | 
  13 | test('Marcus can start a match and Uncle Dave sees seats plus notifications', async ({ browser, page }) => {
  14 |   const { tournamentId, matchId } = await seedLanScenario();
  15 |   page.on('dialog', async (dialog) => {
  16 |     await dialog.accept();
  17 |   });
  18 | 
  19 |   await loginAsAdmin(page);
  20 |   await page.locator(`a[href="/admin/tournaments/${tournamentId}"]`).click();
  21 |   await expect(page).toHaveURL(new RegExp(`/admin/tournaments/${tournamentId}$`));
  22 |   await page.goto(`/admin/tournaments/${tournamentId}?tab=matches`);
  23 |   await page.getByTestId(`match-card-${matchId}`).click();
  24 |   await page.getByTestId('start-match-button').click();
> 25 |   await expect(page.getByTestId(`match-card-${matchId}`)).toContainText(/READY/i);
     |                                                           ^ Error: expect(locator).toContainText(expected) failed
  26 | 
  27 |   const marshalContext = await browser.newContext({
  28 |     storageState: await page.context().storageState(),
  29 |   });
  30 |   const marshalPage = await marshalContext.newPage();
  31 |   await marshalPage.goto('/marshal/dashboard');
  32 |   await expect(marshalPage.getByTestId(`marshal-match-${matchId}`)).toContainText('A12');
  33 |   await expect(marshalPage.getByTestId(`marshal-match-${matchId}`)).toContainText('A13');
  34 |   await expect(marshalPage.getByTestId(`marshal-match-${matchId}`)).toContainText('C01');
  35 |   await expect(marshalPage.getByTestId(`marshal-match-${matchId}`)).toContainText('C02');
  36 |   await expect(marshalPage.getByTestId('notification-entry').first()).toContainText(/Match ready for players/i);
  37 |   await marshalContext.close();
  38 | });
  39 | 
  40 | test('Leo sees a one-click join link without a trailing slash when no password exists', async ({ page }) => {
  41 |   const { matchId } = await seedLanScenario();
  42 | 
  43 |   await loginAs(page, 'leo');
  44 |   await page.goto('/dashboard');
  45 |   await expect(page).toHaveURL(/\/dashboard$/);
  46 | 
  47 |   const joinLink = page.getByTestId(`join-match-${matchId}`);
  48 |   await expect(joinLink).toBeVisible();
  49 |   await expect(joinLink).toHaveAttribute('href', 'steam://connect/127.0.0.1:27015');
  50 | });
  51 | 
  52 | test('Admin can bulk import teams from CSV without leaving the tournament workspace', async ({ page }) => {
  53 |   const { tournamentId } = await seedEmptyTournament();
  54 | 
  55 |   await loginAsAdmin(page);
  56 |   await page.locator(`a[href="/admin/tournaments/${tournamentId}"]`).click();
  57 |   await expect(page).toHaveURL(new RegExp(`/admin/tournaments/${tournamentId}$`));
  58 | 
  59 |   await page.goto(`/admin/tournaments/${tournamentId}?tab=participants`);
  60 |   await page.getByPlaceholder('teamName,seed,playerName,nickname,countryCode,seating,steamId,isLeader').fill([
  61 |     'teamName,seed,playerName,nickname,countryCode,seating,steamId,isLeader',
  62 |     'Alpha,1,Alex,Alex,no,A01,76561198000000111,true',
  63 |     'Alpha,1,Bea,Bea,se,A02,76561198000000112,false',
  64 |     'Bravo,2,Chris,Chris,dk,B01,76561198000000113,true',
  65 |     'Bravo,2,Dana,Dana,fi,B02,76561198000000114,false',
  66 |   ].join('\n'));
  67 |   await page.getByRole('button', { name: 'Import teams' }).click();
  68 | 
  69 |   await expect(page.getByText('Alpha')).toBeVisible();
  70 |   await expect(page.getByText('Bravo')).toBeVisible();
  71 | });
  72 | 
  73 | test('Roster lock disables team edits until an admin unlocks the tournament', async ({ page }) => {
  74 |   const { tournamentId } = await seedLanScenario();
  75 | 
  76 |   await loginAsAdmin(page);
  77 |   await page.locator(`a[href="/admin/tournaments/${tournamentId}"]`).click();
  78 |   await expect(page).toHaveURL(new RegExp(`/admin/tournaments/${tournamentId}$`));
  79 | 
  80 |   await page.goto(`/admin/tournaments/${tournamentId}?tab=settings`);
  81 |   await page.getByLabel('Toggle roster lock').click();
  82 |   // Exact match: the non-editable Game field also reads "CS2 | Locked".
  83 |   await expect(page.getByText('Locked', { exact: true })).toBeVisible();
  84 | 
  85 |   await page.goto(`/admin/tournaments/${tournamentId}?tab=participants`);
  86 |   await expect(page.getByRole('button', { name: /Add Team/i })).toBeDisabled();
  87 |   await expect(page.getByText(/Roster edits are locked because the bracket is already in play/i)).toBeVisible();
  88 | });
  89 | 
```