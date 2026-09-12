// Visual audit only — not part of the suite (zz- prefix, run explicitly with
// `E2E_PORT=4104 npx playwright test e2e/zz-player-visual.spec.ts`).
//
// Covers the *player* surfaces only: the desk (/dashboard) in each of its states, /profile, and
// every state of the register flow. Desktop 1512x950 + phone 390x844, because a player uses this
// on a phone at a LAN table while a marshal walks towards them.
import { test, type Page, type Browser } from '@playwright/test';
import { loginAs, mintSessionToken, personaUserId, type Persona } from './helpers/auth';
import { apiAs, json } from './helpers/api';
import {
  createTeam,
  createTournament,
  clearRegistrations,
  prisma,
  readMatches,
  setRosterLocked,
} from './helpers/lan-seed';

const OUT = process.env.SHOT_DIR || 'test-results/player-shots';
const TEAMS = ['Bergen Bears', 'Tromsø Tigers', 'Oslo Owls', 'Stavanger Storm', 'Nordic Wolves', 'Team Fjord', 'Kristiansand Kings', 'Trondheim Titans'];
const NICKS = ['s1mple', 'dev1ce', 'NiKo', 'ropz', 'ZywOo', 'flameZ', 'jL', 'b1t', 'donk', 'sh1ro', 'electroNic', 'Ax1Le', 'broky', 'rain', 'karrigan', 'frozen', 'blameF', 'Spinx', 'torzsi', 'xertioN', 'siuhy', 'Jimpphat', 'malbsMd', 'Brollan', 'w0nderful', 'iM', 'HObbit', 'zont1x', 'magixx', 'chopper', 'Senzu', 'nicoodoz', 'roeJ', 'Staehr', 'Jabbi', 'dupreeh', 'Magisk', 'stavn', 'sjuush', 'cadiaN'];

/** An 8-team, 5-a-side LAN bracket with real-looking names and seats, already generated. */
async function lanBracket(name: string) {
  const t = await createTournament({ name, teamSize: 5, steamSignupEnabled: true, bo3LastRounds: 2 });
  const teams = [];
  for (let i = 0; i < 8; i++) {
    teams.push(
      await createTeam(t.id, {
        name: TEAMS[i],
        seed: i + 1,
        players: Array.from({ length: 5 }, (_, j) => ({
          name: `Player ${i}${j}`,
          nickname: NICKS[(i * 5 + j) % NICKS.length],
          seating: `${String.fromCharCode(65 + i)}${String(j + 1).padStart(2, '0')}`,
          isLeader: j === 0,
        })),
      })
    );
  }
  const admin = await apiAs('marcus');
  await admin.post(`/api/tournaments/${t.id}/generate`, { data: {} });
  return { t, teams, matches: await readMatches(t.id), admin };
}

/** Seats one persona on one team — a single player row, the way a real signup does. */
async function sitOn(persona: Persona, teamId: string) {
  await mintSessionToken(persona);
  const userId = await personaUserId(persona);
  await clearRegistrations(userId);
  const row = (await prisma.player.findMany({ where: { teamId }, orderBy: { name: 'asc' } }))[0];
  await prisma.player.update({ where: { id: row.id }, data: { userId } });
  return userId;
}

async function seed() {
  // 1. Leo: waiting in line — his match is the last of round 1, three real matches ahead.
  const waiting = await lanBracket('Mortenlab LAN #7');
  const leoMatch = waiting.matches.filter((m) => m.round === 1)[3];
  await sitOn('leo', leoMatch.homeTeamId!);
  // Two earlier matches already played, so the bracket looks mid-LAN rather than pristine.
  for (const m of waiting.matches.filter((x) => x.round === 1).slice(0, 2)) {
    await waiting.admin.post(`/api/matches/${m.id}`, { data: { homeScore: 1, awayScore: 0 } });
  }

  // 2. Sam: called to his station — the money screen.
  const called = await lanBracket('Vestland Open');
  const samMatch = called.matches.filter((m) => m.round === 1)[0];
  await sitOn('sam', samMatch.homeTeamId!);
  const mia = await apiAs('mia');
  await mia.post(`/api/matches/${samMatch.id}/load`, { data: {} });

  // 3. Chloe: live right now.
  const live = await lanBracket('Fjord Masters');
  const chloeMatch = live.matches.filter((m) => m.round === 1)[1];
  await sitOn('chloe', chloeMatch.homeTeamId!);
  await live.admin.post(`/api/matches/${chloeMatch.id}`, { data: { status: 'LIVE' } });

  // 4. Toby: knocked out.
  const out = await lanBracket('Nordlys Cup');
  const tobyMatch = out.matches.filter((m) => m.round === 1)[2];
  const tobyTeamId = tobyMatch.homeTeamId!;
  await sitOn('toby', tobyTeamId);
  await out.admin.post(`/api/matches/${tobyMatch.id}`, { data: { homeScore: 0, awayScore: 2 } });

  // --- register flow fixtures -------------------------------------------------
  // Leo also leads a duo team with an open slot (roster + invite link state).
  const duo = await createTournament({ name: 'Friday Night Duos', teamSize: 2, steamSignupEnabled: true });
  const leoApi = await apiAs('leo');
  const leoTeam = await json<any>(
    await leoApi.post(`/api/tournaments/${duo.id}/signup`, {
      data: { action: 'CREATE_TEAM', teamName: 'Bergen Bears', seating: 'B12' },
    })
  );

  // An empty signup tournament for the "create a team" form.
  const fresh = await createTournament({ name: 'Bergen Winter Clash', teamSize: 5, steamSignupEnabled: true });

  // A locked tournament Sam is already on, and Chloe is not.
  const locked = await createTournament({ name: 'Mortenlab LAN #6', teamSize: 5, steamSignupEnabled: true });
  const samApi = await apiAs('sam');
  await samApi.post(`/api/tournaments/${locked.id}/signup`, {
    data: { action: 'CREATE_TEAM', teamName: 'Tromsø Tigers', seating: 'C04' },
  });
  await setRosterLocked(locked.id, true);

  return { duoId: duo.id, inviteCode: leoTeam.inviteCode as string, freshId: fresh.id, lockedId: locked.id, tobyTeamId };
}

async function shoot(page: Page, name: string, viewport: string) {
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/${viewport}-${name}.png`, fullPage: true });
}

const SIZES = {
  desktop: { width: 1512, height: 950 },
  phone: { width: 390, height: 844 },
} as const;

async function capture(browser: Browser, key: keyof typeof SIZES, f: Awaited<ReturnType<typeof seed>>) {
  // The last shot of each pass un-registers Toby, so put him back before this one.
  await sitOn('toby', f.tobyTeamId);
  const ctx = await browser.newContext({ viewport: SIZES[key], deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  // Register: anonymous first, while this context has no session cookie.
  await page.goto(`/tournaments/${f.freshId}/register`);
  await shoot(page, '20-register-signed-out', key);

  await loginAs(page, 'leo');
  await page.goto('/dashboard'); await shoot(page, '01-desk-waiting', key);
  await page.goto('/profile'); await shoot(page, '10-profile', key);
  await page.goto(`/tournaments/${f.duoId}/register`); await shoot(page, '23-register-my-team', key);

  await loginAs(page, 'sam');
  await page.goto('/dashboard'); await shoot(page, '02-desk-called', key);
  await page.goto(`/tournaments/${f.lockedId}/register`); await shoot(page, '24-register-locked-panel', key);

  await loginAs(page, 'chloe');
  await page.goto('/dashboard'); await shoot(page, '03-desk-live', key);
  await page.goto(`/tournaments/${f.freshId}/register`); await shoot(page, '21-register-create-team', key);
  await page.goto(`/tournaments/${f.duoId}/register?invite=${f.inviteCode}`); await shoot(page, '22-register-join', key);
  await page.goto(`/tournaments/${f.lockedId}/register`); await shoot(page, '25-register-closed', key);

  await loginAs(page, 'toby');
  await page.goto('/dashboard'); await shoot(page, '04-desk-eliminated', key);
  // …and then with nothing at all, which is what a brand-new account sees.
  await clearRegistrations(await personaUserId('toby'));
  await page.goto('/dashboard'); await shoot(page, '05-desk-empty', key);
  await page.goto('/profile'); await shoot(page, '11-profile-empty', key);

  await ctx.close();
}

test('capture the player surfaces', async ({ browser }) => {
  test.setTimeout(600_000);
  const fixtures = await seed();
  for (const key of ['desktop', 'phone'] as const) {
    await capture(browser, key, fixtures);
  }
});
