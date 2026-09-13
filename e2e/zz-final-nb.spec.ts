// Final cross-surface check in Norwegian: the three screens the LAN actually depends on.
import { test, type Page } from '@playwright/test';
import { loginAs, personaUserId, mintSessionToken } from './helpers/auth';
import { apiAs } from './helpers/api';
import { createTournament, createTeam, prisma } from './helpers/lan-seed';

const OUT = process.env.SHOT_DIR!;
const NICKS = ['s1mple','dev1ce','NiKo','ropz','ZywOo','flameZ','jL','b1t','donk','sh1ro'];

async function nb(browser: any, viewport: { width: number; height: number }) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, locale: 'nb-NO' });
  await ctx.clearCookies();
  await ctx.addCookies([{ name: 'apexplay.locale', value: 'nb', domain: '127.0.0.1', path: '/' }]);
  return ctx;
}

test('norsk: the three screens that matter', async ({ browser }) => {
  const t = await createTournament({ name: 'Mortenlab LAN #7', teamSize: 5, steamSignupEnabled: true });
  const names = ['Nordic Wolves', 'Team Fjord', 'Bergen Bears', 'Kristiansand Kings'];
  const teams = [];
  for (let i = 0; i < 4; i++) {
    teams.push(await createTeam(t.id, {
      name: names[i], seed: i + 1,
      players: Array.from({ length: 5 }, (_, j) => ({
        name: `Spiller ${i}${j}`, nickname: NICKS[(i * 5 + j) % NICKS.length],
        seating: `${String.fromCharCode(65 + i)}${String(j + 1).padStart(2, '0')}`, isLeader: j === 0,
      })),
    }));
  }
  const admin = await apiAs('marcus');
  await admin.post(`/api/tournaments/${t.id}/generate`, { data: {} });
  const ms = await prisma.match.findMany({ where: { tournamentId: t.id }, orderBy: [{ round: 'asc' }, { matchOrder: 'asc' }] });
  await admin.post(`/api/matches/${ms[0].id}/load`, { data: {} });          // called
  await admin.post(`/api/matches/${ms[1].id}`, { data: { status: 'LIVE' } }); // live

  // leo is on the CALLED match — the money screen
  await mintSessionToken('leo');
  const called = await prisma.match.findUnique({ where: { id: ms[0].id } });
  const seat = (await prisma.player.findMany({ where: { teamId: called!.homeTeamId! }, orderBy: { name: 'asc' } }))[0];
  await prisma.player.update({ where: { id: seat.id }, data: { userId: await personaUserId('leo') } });
  const crew = await prisma.player.findMany({ where: { teamId: called!.awayTeamId! } });
  await prisma.player.updateMany({ where: { id: { in: crew.slice(0, 2).map(p => p.id) } }, data: { checkedInAt: new Date() } });

  const shoot = async (page: Page, name: string) => {
    await page.waitForTimeout(1400);
    await page.screenshot({ path: `${OUT}/nb-${name}.png`, fullPage: true });
  };

  const phone = await nb(browser, { width: 390, height: 844 });
  let p = await phone.newPage();
  await loginAs(p, 'leo');
  await p.goto('/dashboard');            await shoot(p, '1-spiller-din-tur');
  await loginAs(p, 'mia');
  await p.goto(`/marshal/dashboard?t=${t.id}`);
  await p.getByTestId(`marshal-match-${ms[0].id}`).waitFor({ timeout: 30000 });
  await shoot(p, '2-crew-board');
  await phone.close();

  const desk = await nb(browser, { width: 1512, height: 950 });
  p = await desk.newPage();
  await p.goto(`/tournaments/${t.id}`);  await shoot(p, '3-offentlig');
  await loginAs(p, 'marcus');
  await p.goto(`/admin/tournaments/${t.id}`); await shoot(p, '4-arrangor-kontroll');
  await desk.close();
});
