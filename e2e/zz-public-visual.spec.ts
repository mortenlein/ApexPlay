// Visual audit of the PUBLIC tournament page only — not part of the suite (zz- prefix,
// `testIgnore` in playwright.config.ts). Run it explicitly and look at the PNGs:
//
//   SHOT_DIR=/tmp/shots E2E_PORT=4103 npx playwright test e2e/zz-public-visual.spec.ts
//
// Seeds a realistic mid-LAN state (8 teams with long Norwegian club names, five-player rosters,
// two matches played, one live, one called) and screenshots every spectator tab at desktop
// (1512x950) and phone (390x844).
import { test, type Page } from '@playwright/test';
import { apiAs } from './helpers/api';
import { createTournament, createTeam, prisma } from './helpers/lan-seed';

const OUT = process.env.SHOT_DIR!;
const TEAMS = ['Nordic Wolves', 'Team Fjord', 'Bergen Bears', 'Oslo Owls', 'Stavanger Storm', 'Tromsø Tigers', 'Kristiansand Kings', 'Trondheim Titans'];
const NICKS = ['s1mple', 'dev1ce', 'NiKo', 'ropz', 'ZywOo', 'flameZ', 'jL', 'b1t', 'donk', 'sh1ro', 'electroNic', 'Ax1Le', 'broky', 'rain', 'karrigan', 'frozen', 'blameF', 'Spinx', 'torzsi', 'xertioN', 'siuhy', 'Jimpphat', 'malbsMd', 'Brollan', 'w0nderful', 'iM', 'HObbit', 'zont1x', 'magixx', 'chopper', 'Senzu', 'nicoodoz', 'roeJ', 'Staehr', 'Jabbi', 'dupreeh', 'Magisk', 'stavn', 'sjuush', 'cadiaN'];

async function seed() {
  const t = await createTournament({ name: 'Mortenlab LAN #7', teamSize: 5, steamSignupEnabled: true, format: 'SINGLE_ELIMINATION', bo3LastRounds: 2 });
  for (let i = 0; i < 8; i++) {
    await createTeam(t.id, {
      name: TEAMS[i], seed: i + 1,
      players: Array.from({ length: 5 }, (_, j) => ({
        name: `Player ${i}${j}`, nickname: NICKS[(i * 5 + j) % NICKS.length],
        seating: `${String.fromCharCode(65 + i)}${String(j + 1).padStart(2, '0')}`,
        countryCode: ['no', 'se', 'dk', 'fi'][j % 4], isLeader: j === 0,
      })),
    });
  }
  const admin = await apiAs('marcus');
  await admin.post(`/api/tournaments/${t.id}/generate`, { data: {} });
  const matches = await prisma.match.findMany({ where: { tournamentId: t.id }, orderBy: [{ round: 'asc' }, { matchOrder: 'asc' }] });
  // R1: two finished, one live, one called.
  await admin.post(`/api/matches/${matches[0].id}`, { data: { homeScore: 1, awayScore: 0, bestOf: 1, status: 'COMPLETED' } });
  await admin.post(`/api/matches/${matches[1].id}`, { data: { homeScore: 0, awayScore: 1, bestOf: 1, status: 'COMPLETED' } });
  await admin.post(`/api/matches/${matches[2].id}`, { data: { homeScore: 0, awayScore: 0, status: 'LIVE' } });
  await admin.post(`/api/matches/${matches[3].id}/load`, { data: {} });
  return { t };
}

async function shoot(page: Page, name: string, viewport: 'desktop' | 'phone') {
  await page.waitForTimeout(1100);
  await page.screenshot({ path: `${OUT}/${viewport}-${name}.png`, fullPage: true });
}

test('capture the public tournament tabs', async ({ browser }) => {
  const { t } = await seed();
  const sizes = { desktop: { width: 1512, height: 950 }, phone: { width: 390, height: 844 } } as const;

  for (const key of ['desktop', 'phone'] as const) {
    const ctx = await browser.newContext({ viewport: sizes[key], deviceScaleFactor: 2 });
    const page = await ctx.newPage();

    await page.goto(`/tournaments/${t.id}`); await shoot(page, '01-overview', key);
    await page.goto(`/tournaments/${t.id}?tab=bracket`); await shoot(page, '02-bracket', key);
    await page.goto(`/tournaments/${t.id}?tab=teams`); await shoot(page, '03-teams', key);
    await page.goto(`/tournaments/${t.id}?tab=players`); await shoot(page, '04-players', key);
    await page.goto(`/tournaments/${t.id}?tab=matches`); await shoot(page, '05-matches', key);

    await ctx.close();
  }
});
