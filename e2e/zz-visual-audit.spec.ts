// Visual audit only — not part of the suite (zz- prefix, run explicitly).
// Seeds a realistic mid-LAN state and screenshots every surface at desktop + phone.
import { test, type Page } from '@playwright/test';
import { loginAs, personaUserId, mintSessionToken } from './helpers/auth';
import { apiAs, json } from './helpers/api';
import { createTournament, createTeam, prisma } from './helpers/lan-seed';

const OUT = process.env.SHOT_DIR!;
const TEAMS = ['Nordic Wolves', 'Team Fjord', 'Bergen Bears', 'Oslo Owls', 'Stavanger Storm', 'Tromsø Tigers', 'Kristiansand Kings', 'Trondheim Titans'];
const NICKS = ['s1mple', 'dev1ce', 'NiKo', 'ropz', 'ZywOo', 'flameZ', 'jL', 'b1t', 'donk', 'sh1ro', 'electroNic', 'Ax1Le', 'broky', 'rain', 'karrigan', 'frozen', 'blameF', 'Spinx', 'torzsi', 'xertioN', 'siuhy', 'Jimpphat', 'malbsMd', 'Brollan', 'w0nderful', 'iM', 'HObbit', 'zont1x', 'magixx', 'chopper', 'Senzu', 'nicoodoz', 'roeJ', 'Staehr', 'Jabbi', 'dupreeh', 'Magisk', 'stavn', 'sjuush', 'cadiaN'];

async function seed() {
  const t = await createTournament({ name: 'Mortenlab LAN #7', teamSize: 5, steamSignupEnabled: true, format: 'SINGLE_ELIMINATION', bo3LastRounds: 2 });
  const teams = [];
  for (let i = 0; i < 8; i++) {
    teams.push(await createTeam(t.id, {
      name: TEAMS[i], seed: i + 1,
      players: Array.from({ length: 5 }, (_, j) => ({
        name: `Player ${i}${j}`, nickname: NICKS[(i * 5 + j) % NICKS.length],
        seating: `${String.fromCharCode(65 + i)}${String(j + 1).padStart(2, '0')}`,
        countryCode: ['no', 'se', 'dk', 'fi'][j % 4], isLeader: j === 0,
      })),
    }));
  }
  const admin = await apiAs('marcus');
  await admin.post(`/api/tournaments/${t.id}/generate`, { data: {} });
  const matches = await prisma.match.findMany({ where: { tournamentId: t.id }, orderBy: [{ round: 'asc' }, { matchOrder: 'asc' }] });
  // R1: two finished, one live, one called
  await admin.post(`/api/matches/${matches[0].id}`, { data: { homeScore: 1, awayScore: 0, bestOf: 1, status: 'COMPLETED' } });
  await admin.post(`/api/matches/${matches[1].id}`, { data: { homeScore: 0, awayScore: 1, bestOf: 1, status: 'COMPLETED' } });
  await admin.post(`/api/matches/${matches[2].id}`, { data: { homeScore: 0, awayScore: 0, status: 'LIVE' } });
  await admin.post(`/api/matches/${matches[3].id}/load`, { data: {} });
  // a couple of players checked in on the called match
  const called = await prisma.match.findUnique({ where: { id: matches[3].id } });
  const ps = await prisma.player.findMany({ where: { teamId: called!.homeTeamId! } });
  await prisma.player.updateMany({ where: { id: { in: ps.slice(0, 3).map(p => p.id) } }, data: { checkedInAt: new Date() } });
  // leo is on a team that is waiting
  await mintSessionToken('leo');
  const leoTeam = teams.find(x => x.id === called!.awayTeamId) || teams[7];
  const leoSeat = (await prisma.player.findMany({ where: { teamId: leoTeam.id }, orderBy: { name: 'asc' } }))[0];
  await prisma.player.update({ where: { id: leoSeat.id }, data: { userId: await personaUserId('leo') } });
  // a second, draft tournament so lists aren't single-row
  await createTournament({ name: 'Friday Night Duos', teamSize: 2, steamSignupEnabled: true });
  return { t, matches, called };
}

async function shoot(page: Page, name: string, viewport: 'desktop' | 'phone') {
  await page.waitForTimeout(1100);
  await page.screenshot({ path: `${OUT}/${viewport}-${name}.png`, fullPage: true });
}

test('capture every surface', async ({ browser }) => {
  const { t, matches, called } = await seed();
  const sizes = { desktop: { width: 1512, height: 950 }, phone: { width: 390, height: 844 } } as const;

  for (const key of ['desktop', 'phone'] as const) {
    const ctx = await browser.newContext({ viewport: sizes[key], deviceScaleFactor: 2 });
    const page = await ctx.newPage();

    await page.goto('/'); await shoot(page, '01-landing-anon', key);
    await page.goto('/tournaments'); await shoot(page, '02-directory', key);
    await page.goto(`/tournaments/${t.id}`); await shoot(page, '03-public-bracket', key);
    await page.goto(`/tournaments/${t.id}?tab=teams`); await shoot(page, '04-public-teams', key);
    await page.goto(`/tournaments/${t.id}?tab=matches`); await shoot(page, '05-public-matches', key);

    await loginAs(page, 'leo');
    await page.goto('/dashboard'); await shoot(page, '06-player-home', key);
    await page.goto(`/tournaments/${t.id}/register`); await shoot(page, '07-register', key);
    await page.goto('/profile'); await shoot(page, '08-profile', key);

    await loginAs(page, 'mia');
    await page.goto('/marshal/dashboard'); await shoot(page, '09-marshal', key);

    await loginAs(page, 'marcus');
    await page.goto('/admin'); await shoot(page, '10-admin-dashboard', key);
    await page.goto(`/admin/tournaments/${t.id}`); await shoot(page, '11-manage-control', key);
    await page.goto(`/admin/tournaments/${t.id}?tab=matches`); await shoot(page, '12-manage-matches', key);
    await page.goto(`/admin/tournaments/${t.id}?tab=participants`); await shoot(page, '13-manage-participants', key);
    await page.goto(`/admin/tournaments/${t.id}?tab=settings`); await shoot(page, '14-manage-settings', key);
    await page.goto('/login'); await shoot(page, '15-login', key);
    await ctx.close();
  }

  // Modal + OBS shots (desktop only)
  const ctx = await browser.newContext({ viewport: { width: 1512, height: 950 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await loginAs(page, 'marcus');
  await page.goto(`/admin/tournaments/${t.id}?tab=matches`);
  await page.getByTestId(`match-card-${matches[3].id}`).click();
  await shoot(page, '16-match-modal', 'desktop');
  await page.goto(`/admin/tournaments/${t.id}?tab=participants`);
  const edit = page.getByRole('button', { name: /edit/i }).first();
  if (await edit.count()) { await edit.click(); await shoot(page, '17-team-modal', 'desktop'); }
  await page.goto('/admin'); await page.getByRole('button', { name: /create tournament/i }).first().click();
  await shoot(page, '18-wizard', 'desktop');
  const obs = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const op = await obs.newPage();
  await op.goto(`/bracket/${t.id}/overlay`); await shoot(op, '19-obs-overlay', 'desktop');
  await op.goto(`/bracket/${t.id}/roster`); await shoot(op, '20-obs-roster', 'desktop');
  await ctx.close(); await obs.close();
});
