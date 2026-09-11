# ApexPlay — working notes

CS2 LAN tournament platform. Next 15 (App Router) + Prisma 6/SQLite + next-auth Steam.
The parent `~/apps/CLAUDE.md` house standards are inherited, with one deliberate exception:
ApexPlay is **PUBLIC with its own Steam auth**, not behind Cloudflare Access (players log in).

## Run & verify
- `npm run dev` — dev server on **4001** (migrations run first). Also `npx tsc --noEmit`,
  `npm run lint`, `npm run test:bracket` (bracket + match-result units).
- `npm run test:e2e` — Playwright starts its own dev server on **4101** (override with `E2E_PORT=4102`
  to run a second suite in parallel — port and SQLite file are per port), so that port must be
  free. `playwright.config.ts` injects a `STEAM_API_KEY` placeholder (without a value
  `SteamProvider` throws at construction and every `/api/auth/*` route 500s), the mock-auth flags
  and a separate `prisma/e2e-<port>.db`. Never point tests or scripts at `data/prod.db`.

## Branch & deploy
- Work on a branch, never commit straight to `main`. Commit only when asked.
- Deploy on `ash` from `/home/mole/apps/ApexPlay`:
  `docker compose -f docker-compose.prod.yml up -d --build` → loopback `127.0.0.1:8089` behind
  the cloudflared tunnel at `apexplay.mortenlab.xyz`. Logs `docker logs -f apexplay`; backups
  `./scripts/backup.sh` (restore steps in its header).
- Secrets only in the gitignored `.env` (chmod 600); `.env.example` documents every variable the
  code reads — keep it in sync.

## Two rules that must not be broken
1. **Status vocabulary.** `src/lib/match-status.ts` is the only definition of match status
   (`PENDING`/`READY`/`LIVE`/`COMPLETED`, plus legacy `WAITING_FOR_PLAYERS`/`FINISHED` in the
   shared sets). Use `isDone`/`isCalled`/`isLive`/`isActive` and the `*_STATUSES` sets — no
   hand-rolled string comparisons anywhere. `scoreLimit` is always `scoreLimitFor(bestOf)`.
2. **Public vs staff payloads.** A non-staff response must never carry `inviteCode` (except to a
   member of that team), `steamId`, `userId`, `serverPassword`/`serverIp`/`serverPort` or
   `eonBridgeToken`. Staff = `isStaffSteamId` (admin ∪ marshal). `src/lib/api.ts` is the SSR
   prefetch layer and its output is serialized into the HTML, so it **must mirror the matching
   route handlers' public shapes** — change a route's `select`/shaping, change `api.ts` too.

Roles come from `ADMIN_STEAMIDS`/`MARSHAL_STEAMIDS` via `src/lib/admin-config.ts`; guards live in
`src/lib/route-auth.ts` (`requireAdminApi` = settings/bracket/import, `requireStaffApi` = match
flow). Pure match-save logic belongs in `src/lib/match-result.ts`, so it stays unit-testable.

**Pointers:** `docs/LAN-RUNBOOK.md` (operator runbook) · `ANALYSIS_AND_ROADMAP.md` (status,
limitations, remaining work) · `design.md` (tokens and components).
