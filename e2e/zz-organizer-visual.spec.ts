// Visual audit for the ORGANIZER surfaces only — not part of the suite (zz- prefix, run explicitly):
//   E2E_PORT=4105 SHOT_DIR=/tmp/shots npx playwright test e2e/zz-organizer-visual.spec.ts
//
// Seeds a realistic mid-LAN state (8 teams, results in, one live, one called) and screenshots
// /admin plus every tab of /admin/tournaments/[id] and the three modals, at:
//   desktop 1512x950 · laptop 1280x720 (a LAN organiser's small laptop) · phone 390x844.
// The laptop size is not decoration: a modal that does not fit there is a real failure.
import { test, type Page } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { apiAs } from './helpers/api';
import { createTournament, createTeam, prisma } from './helpers/lan-seed';

const OUT = process.env.SHOT_DIR || '/tmp/organizer-shots';
const TEAMS = ['Nordic Wolves', 'Team Fjord', 'Bergen Bears', 'Oslo Owls', 'Stavanger Storm', 'Tromsø Tigers', 'Kristiansand Kings', 'Trondheim Titans'];
const NICKS = ['s1mple', 'dev1ce', 'NiKo', 'ropz', 'ZywOo', 'flameZ', 'jL', 'b1t', 'donk', 'sh1ro', 'electroNic', 'Ax1Le', 'broky', 'rain', 'karrigan', 'frozen', 'blameF', 'Spinx', 'torzsi', 'xertioN', 'siuhy', 'Jimpphat', 'malbsMd', 'Brollan', 'w0nderful', 'iM', 'HObbit', 'zont1x', 'magixx', 'chopper', 'Senzu', 'nicoodoz', 'roeJ', 'Staehr', 'Jabbi', 'dupreeh', 'Magisk', 'stavn', 'sjuush', 'cadiaN'];

const SIZES = {
  desktop: { width: 1512, height: 950 },
  laptop: { width: 1280, height: 720 },
  phone: { width: 390, height: 844 },
} as const;
type SizeKey = keyof typeof SIZES;

async function seed() {
  const t = await createTournament({ name: 'Mortenlab LAN #7', teamSize: 5, steamSignupEnabled: true, format: 'SINGLE_ELIMINATION', bo3LastRounds: 2 });
  for (let i = 0; i < 8; i++) {
    await createTeam(t.id, {
      name: TEAMS[i], seed: i + 1,
      players: Array.from({ length: 5 }, (_, j) => ({
        name: `Player ${i}${j}`, nickname: NICKS[(i * 5 + j) % NICKS.length],
        seating: `${String.fromCharCode(65 + i)}${String(j + 1).padStart(2, '0')}`,
        isLeader: j === 0,
      })),
    });
  }
  const admin = await apiAs('marcus');
  await admin.post(`/api/tournaments/${t.id}/generate`, { data: {} });
  const matches = await prisma.match.findMany({ where: { tournamentId: t.id }, orderBy: [{ round: 'asc' }, { matchOrder: 'asc' }] });
  // R1: two finished, one live, one called — the mid-LAN state the cockpit is designed for.
  await admin.post(`/api/matches/${matches[0].id}`, { data: { homeScore: 1, awayScore: 0, bestOf: 1, status: 'COMPLETED' } });
  await admin.post(`/api/matches/${matches[1].id}`, { data: { homeScore: 0, awayScore: 1, bestOf: 1, status: 'COMPLETED' } });
  await admin.post(`/api/matches/${matches[2].id}`, { data: { homeScore: 0, awayScore: 0, status: 'LIVE' } });
  await admin.post(`/api/matches/${matches[3].id}/load`, { data: {} });
  const called = await prisma.match.findUnique({ where: { id: matches[3].id } });
  const ps = await prisma.player.findMany({ where: { teamId: called!.homeTeamId! } });
  await prisma.player.updateMany({ where: { id: { in: ps.slice(0, 3).map((p) => p.id) } }, data: { checkedInAt: new Date() } });
  // A second, draft tournament so the dashboard list is not a single row.
  await createTournament({ name: 'Friday Night Duos', teamSize: 2, steamSignupEnabled: true });
  return { t, matches };
}

/**
 * The manage workspace scrolls an inner pane, not the document, so `fullPage` stops at the fold.
 * This drives that pane to the bottom and shoots what is underneath.
 */
async function shootBottom(page: Page, name: string, viewport: SizeKey) {
  await page.evaluate(() => {
    const pane = document.querySelector('main .custom-scrollbar') as HTMLElement | null;
    if (pane) pane.scrollTop = pane.scrollHeight;
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${viewport}-${name}-bottom.png` });
}

async function shoot(page: Page, name: string, viewport: SizeKey, fullPage = true) {
  // 4s, not 1s: the workspace hydrates from the SSR payload and refetches a moment later, and the
  // second paint is the one an organizer actually sits in front of.
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${OUT}/${viewport}-${name}.png`, fullPage });
}

// `next dev` compiles each heavy route on first hit, so every viewport gets its own test (and
// its own timeout) rather than one long sweep.
test.describe.configure({ mode: 'serial' });
test.setTimeout(600000);

for (const key of Object.keys(SIZES) as SizeKey[]) {
  test(`capture the organizer surfaces — ${key}`, async ({ browser }) => {
    const { t, matches } = await seed();
    const ctx = await browser.newContext({ viewport: SIZES[key], deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await loginAs(page, 'marcus');

    await page.goto('/admin'); await shoot(page, '01-admin-dashboard', key);
    await page.goto(`/admin/tournaments/${t.id}?tab=control`); await shoot(page, '02-control', key); await shootBottom(page, '02-control', key);
    await page.goto(`/admin/tournaments/${t.id}?tab=overview`); await shoot(page, '03-overview', key); await shootBottom(page, '03-overview', key);
    await page.goto(`/admin/tournaments/${t.id}?tab=participants`); await shoot(page, '04-teams', key); await shootBottom(page, '04-teams', key);
    await page.goto(`/admin/tournaments/${t.id}?tab=matches`); await shoot(page, '05-matches', key); await shootBottom(page, '05-matches', key);
    await page.goto(`/admin/tournaments/${t.id}?tab=settings`); await shoot(page, '06-settings', key); await shootBottom(page, '06-settings', key);

    // Modals: never fullPage — what matters is whether they fit THIS window.
    await page.goto(`/admin/tournaments/${t.id}?tab=matches`);
    await page.getByTestId(`match-card-${matches[2].id}`).click();
    await shoot(page, '07-match-modal', key, false);
    await page.keyboard.press('Escape');

    await page.goto(`/admin/tournaments/${t.id}?tab=participants`);
    // .click() auto-waits for the roster query to land; .count() would not.
    await page.getByRole('button', { name: /^Edit /i }).first().click();
    await shoot(page, '08-team-modal', key, false);

    // The create wizard, at several steps.
    await page.goto('/admin');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await shoot(page, '09-wizard-step1-game', key, false);
    await page.getByRole('button', { name: /Counter-Strike 2/ }).click();
    await page.getByPlaceholder('e.g. Winter Invitational 2024').fill('Visual Audit Cup');
    await page.getByRole('button', { name: 'Continue' }).click();
    await shoot(page, '10-wizard-step3-format', key, false);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await shoot(page, '11-wizard-step5-review', key, false);

    await ctx.close();
  });
}
