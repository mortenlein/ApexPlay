import { expect, test, type APIRequestContext } from '@playwright/test';
import { apiAnon, apiAs, disposeApiContexts, json } from './helpers/api';
import { createCallableMatch, createSeededTeams, readMatches } from './helpers/lan-seed';

/**
 * The audit trail: every staff mutation lands in `AuditLog` with a stable `action` string and an
 * `actor` that names the human *and* their role (`buildActorLabel` in `src/lib/audit.ts` →
 * "Marcus · admin", "Mia · marshal"). `GET /api/audit-log` is the admin read side — a marshal
 * can run matches but cannot read the trail.
 */
test.describe.configure({ mode: 'serial' });
test.afterEach(disposeApiContexts);

interface Entry {
  action: string;
  actor: string | null;
  summary: string;
  entityType: string;
  tournamentId: string | null;
}

async function auditEntries(api: APIRequestContext, tournamentId: string): Promise<Entry[]> {
  const res = await api.get(`/api/audit-log?tournamentId=${tournamentId}`);
  expect(res.status()).toBe(200);
  return (await json(res)).entries as Entry[];
}

test('an organizer run-through writes the whole trail with an admin actor', async () => {
  const marcus = await apiAs('marcus');

  const created = await marcus.post('/api/tournaments', {
    data: { name: `Audit Cup ${Date.now()}`, game: 'CS2', teamSize: 2, format: 'SINGLE_ELIMINATION' },
  });
  expect(created.status()).toBe(200);
  const tournamentId = (await json(created)).id as string;

  const team = await marcus.post(`/api/tournaments/${tournamentId}/teams`, {
    data: { name: 'Audit Crew', seed: 1, players: [{ name: 'Audit Player' }] },
  });
  expect(team.status()).toBe(200);
  await createSeededTeams(tournamentId, 3);

  expect((await marcus.post(`/api/tournaments/${tournamentId}/generate`, { data: {} })).status()).toBe(200);
  const semi = (await readMatches(tournamentId)).find((m) => m.round === 1)!;
  expect((await marcus.post(`/api/matches/${semi.id}`, { data: { homeScore: 1, awayScore: 0 } })).status()).toBe(200);

  const entries = await auditEntries(marcus, tournamentId);
  expect(entries.map((entry) => entry.action)).toEqual(
    expect.arrayContaining(['tournament.created', 'team.created', 'bracket.generated', 'match.updated'])
  );
  // Every row is attributed to the identity that did it, with the role spelled out.
  for (const entry of entries) {
    expect(entry.actor, entry.action).toBe('Marcus · admin');
    expect(entry.tournamentId, entry.action).toBe(tournamentId);
  }

  const scoreRow = entries.find((entry) => entry.action === 'match.updated')!;
  expect(scoreRow.entityType).toBe('match');
  expect(scoreRow.summary).toContain(`Updated match ${semi.id.slice(0, 8)} to 1:0 (COMPLETED)`);
});

test('floor actions are attributed to the marshal who took them', async () => {
  const { tournament, home, match } = await createCallableMatch();
  const mia = await apiAs('mia');
  const marcus = await apiAs('marcus');

  expect((await mia.post(`/api/matches/${match.id}/load`)).status()).toBe(200);
  const player = home.players[0];
  expect((await mia.post(`/api/players/${player.id}/checkin`, { data: { checkedIn: true } })).status()).toBe(200);
  expect((await mia.post(`/api/matches/${match.id}`, { data: { forfeit: 'AWAY' } })).status()).toBe(200);

  const entries = await auditEntries(marcus, tournament.id);
  const byAction = new Map(entries.map((entry) => [entry.action, entry]));
  expect([...byAction.keys()]).toEqual(
    expect.arrayContaining(['match.loaded', 'player.checkedIn', 'match.updated'])
  );
  expect(byAction.get('match.loaded')!.actor).toBe('Mia · marshal');
  expect(byAction.get('player.checkedIn')!.actor).toBe('Mia · marshal');
  expect(byAction.get('player.checkedIn')!.summary).toContain('confirmed at seat A12');

  // Clearing the same check-in is its own action, not an overwrite of the first one.
  expect((await mia.post(`/api/players/${player.id}/checkin`, { data: { checkedIn: false } })).status()).toBe(200);
  const cleared = (await auditEntries(marcus, tournament.id)).map((entry) => entry.action);
  expect(cleared).toContain('player.checkedIn');
  expect(cleared).toContain('player.checkinCleared');
  // A forfeit is a match update that says so in the summary.
  expect(byAction.get('match.updated')!.summary).toContain('by forfeit');
});

test('the trail is admin-only and scoped to the tournament asked for', async () => {
  const mine = await createCallableMatch();
  const other = await createCallableMatch();
  const marcus = await apiAs('marcus');
  const mia = await apiAs('mia');
  const leo = await apiAs('leo');
  const anon = await apiAnon();

  expect((await marcus.post(`/api/matches/${mine.match.id}/load`)).status()).toBe(200);
  expect((await marcus.post(`/api/matches/${other.match.id}/load`)).status()).toBe(200);

  const mineEntries = await auditEntries(marcus, mine.tournament.id);
  expect(mineEntries).toHaveLength(1);
  expect(mineEntries[0]).toMatchObject({ action: 'match.loaded', tournamentId: mine.tournament.id });

  // A player, and even a marshal who can run the floor, cannot read the trail.
  for (const [who, api] of [
    ['mia', mia],
    ['leo', leo],
    ['anon', anon],
  ] as const) {
    const res = await api.get(`/api/audit-log?tournamentId=${mine.tournament.id}`);
    expect(res.status(), who).toBe(401);
    expect((await json(res)).error, who).toBe('Unauthorized');
  }
});
