// NORWEGIAN visual audit for the ORGANIZER surfaces — not part of the suite (zz- prefix):
//   E2E_PORT=4105 SHOT_DIR=/tmp/shots VISUAL_AUDIT=1 npx playwright test e2e/zz-organizer-visual-nb.spec.ts
//
// The English twin is e2e/zz-organizer-visual.spec.ts; this one flips the locale cookie to `nb`
// before anything renders, because Norwegian is materially longer than English ("Settings" →
// "Innstillinger", "Registration" → "Påmelding") and these are the densest screens in the app.
// Only the two laptop-and-up sizes are shot: 1512x950 is the desk machine, and 1280x720 is the
// small laptop an organizer actually brings to a LAN — a modal that stops fitting there has
// already cost us once, so it is a real failure, not a nice-to-have.
import { test, type Page } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { apiAs } from './helpers/api';
import { createTournament, createTeam, prisma } from './helpers/lan-seed';

const OUT = process.env.SHOT_DIR || '/tmp/organizer-shots-nb';
const TEAMS = ['Nordic Wolves', 'Team Fjord', 'Bergen Bears', 'Oslo Owls', 'Stavanger Storm', 'Tromsø Tigers', 'Kristiansand Kings', 'Trondheim Titans'];
const NICKS = ['s1mple', 'dev1ce', 'NiKo', 'ropz', 'ZywOo', 'flameZ', 'jL', 'b1t', 'donk', 'sh1ro', 'electroNic', 'Ax1Le', 'broky', 'rain', 'karrigan', 'frozen', 'blameF', 'Spinx', 'torzsi', 'xertioN', 'siuhy', 'Jimpphat', 'malbsMd', 'Brollan', 'w0nderful', 'iM', 'HObbit', 'zont1x', 'magixx', 'chopper', 'Senzu', 'nicoodoz', 'roeJ', 'Staehr', 'Jabbi', 'dupreeh', 'Magisk', 'stavn', 'sjuush', 'cadiaN'];

const SIZES = {
  desktop: { width: 1512, height: 950 },
  laptop: { width: 1280, height: 720 },
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
  await admin.post(`/api/matches/${matches[0].id}`, { data: { homeScore: 1, awayScore: 0, bestOf: 1, status: 'COMPLETED' } });
  await admin.post(`/api/matches/${matches[1].id}`, { data: { homeScore: 0, awayScore: 1, bestOf: 1, status: 'COMPLETED' } });
  await admin.post(`/api/matches/${matches[2].id}`, { data: { homeScore: 0, awayScore: 0, status: 'LIVE' } });
  await admin.post(`/api/matches/${matches[3].id}/load`, { data: {} });
  const called = await prisma.match.findUnique({ where: { id: matches[3].id } });
  const ps = await prisma.player.findMany({ where: { teamId: called!.homeTeamId! } });
  await prisma.player.updateMany({ where: { id: { in: ps.slice(0, 3).map((p) => p.id) } }, data: { checkedInAt: new Date() } });
  await createTournament({ name: 'Friday Night Duos', teamSize: 2, steamSignupEnabled: true });
  return { t, matches };
}

async function shootBottom(page: Page, name: string, viewport: SizeKey) {
  await page.evaluate(() => {
    const pane = document.querySelector('main .custom-scrollbar') as HTMLElement | null;
    if (pane) pane.scrollTop = pane.scrollHeight;
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${viewport}-${name}-bottom.png` });
}

async function shoot(page: Page, name: string, viewport: SizeKey, fullPage = true) {
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${OUT}/${viewport}-${name}.png`, fullPage });
}

test.describe.configure({ mode: 'serial' });
test.setTimeout(600000);

for (const key of Object.keys(SIZES) as SizeKey[]) {
  test(`capture the organizer surfaces in Norwegian — ${key}`, async ({ browser }) => {
    const { t, matches } = await seed();
    // The config pins every context to `en`; this one is explicitly Norwegian, which is what the
    // club actually runs on. `getRequestLocale` reads this cookie before Accept-Language.
    const ctx = await browser.newContext({
      viewport: SIZES[key],
      deviceScaleFactor: 1,
      storageState: {
        cookies: [
          { name: 'summit.locale', value: 'nb', domain: '127.0.0.1', path: '/', expires: -1, httpOnly: false, secure: false, sameSite: 'Lax' as const },
        ],
        origins: [],
      },
    });
    const page = await ctx.newPage();
    await loginAs(page, 'marcus');

    await page.goto('/admin'); await shoot(page, '01-admin-dashboard', key);
    await page.goto(`/admin/tournaments/${t.id}?tab=control`); await shoot(page, '02-control', key); await shootBottom(page, '02-control', key);
    await page.goto(`/admin/tournaments/${t.id}?tab=overview`); await shoot(page, '03-overview', key); await shootBottom(page, '03-overview', key);
    await page.goto(`/admin/tournaments/${t.id}?tab=participants`); await shoot(page, '04-teams', key); await shootBottom(page, '04-teams', key);
    await page.goto(`/admin/tournaments/${t.id}?tab=matches`); await shoot(page, '05-matches', key); await shootBottom(page, '05-matches', key);
    await page.goto(`/admin/tournaments/${t.id}?tab=settings`); await shoot(page, '06-settings', key); await shootBottom(page, '06-settings', key);

    // Modals: never fullPage — what matters is whether they fit THIS window in Norwegian.
    await page.goto(`/admin/tournaments/${t.id}?tab=matches`);
    await page.getByTestId(`match-card-${matches[2].id}`).click();
    await shoot(page, '07-match-modal', key, false);
    await page.keyboard.press('Escape');

    await page.goto(`/admin/tournaments/${t.id}?tab=participants`);
    await page.getByRole('button', { name: /^Rediger /i }).first().click();
    await shoot(page, '08-team-modal', key, false);

    await page.goto('/admin');
    await page.getByRole('button', { name: 'Ny', exact: true }).click();
    await shoot(page, '09-wizard-step1-game', key, false);
    await page.getByRole('button', { name: /Counter-Strike 2/ }).click();
    await page.getByPlaceholder('f.eks. Vinterturnering 2026').fill('Visuell revisjon');
    await page.getByRole('button', { name: 'Fortsett' }).click();
    await shoot(page, '10-wizard-step3-format', key, false);
    await page.getByRole('button', { name: 'Fortsett' }).click();
    await shoot(page, '11-wizard-step4-series', key, false);
    await page.getByRole('button', { name: 'Fortsett' }).click();
    await shoot(page, '12-wizard-step5-review', key, false);

    await ctx.close();
  });
}
