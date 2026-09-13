# Summit — Status & remaining work (Sept 2026)

Written for the revision pass ahead of the mid-October 2026 LAN. This replaces the June audit:
the findings in it have either been fixed (see below) or are restated here as a live limitation.

- Operator instructions: [`docs/LAN-RUNBOOK.md`](docs/LAN-RUNBOOK.md)
- Contributor conventions: [`CLAUDE.md`](CLAUDE.md)
- Design language: [`design.md`](design.md)

---

## 1. What's done

**Platform**
- Next.js 15.5 / React 19, Prisma 6, dependencies refreshed off the stale (and vulnerable) set.
- Production deploy is real: `docker-compose.prod.yml` on `ash`, loopback `127.0.0.1:8089` behind
  the cloudflared tunnel at `turnering.mortenlab.xyz`, Prisma CLI baked into the image so
  `migrate deploy` at boot needs no network. `force-dynamic` on the DB/auth routes.
- `scripts/backup.sh`: consistent `VACUUM INTO` snapshot taken inside the container, verified
  with `PRAGMA integrity_check`, uploads archived, old files pruned, restore steps in the header.

**Auth & authorization**
- Steam sign-in is required for everything. Anonymous registration and anonymous uploads are gone.
- Roles are identities, not passwords: `ADMIN_STEAMIDS` -> admin, `MARSHAL_STEAMIDS` -> marshal,
  everyone else player. One helper module (`src/lib/admin-config.ts`) and one route-guard module
  (`src/lib/route-auth.ts`); the command palette and nav gate on the session role.
- Staff (admin **or** marshal) can call and score matches; tournament settings, bracket
  generation, CSV import and the EON bridge stay admin-only.

**API shape & data exposure**
- Public vs staff payloads are separated in the route handlers: `inviteCode` (only to your own
  team), `steamId`, `userId`, `serverPassword`/`serverIp`/`serverPort` and `eonBridgeToken` never
  reach a non-staff response.
- The SSR prefetch layer (`src/lib/api.ts`) mirrors those shapes, so the dehydrated React Query
  state embedded in the HTML cannot leak what the API withholds.
- Optimistic-concurrency guard on match saves (`expectedUpdatedAt` -> 409) and a roster/bracket
  lock guard (423) in `src/lib/mutation-guards.ts`.

**Bracket & match correctness**
- One canonical status vocabulary in `src/lib/match-status.ts` (`PENDING` / `READY` / `LIVE` /
  `COMPLETED`, with the historical `WAITING_FOR_PLAYERS` and `FINISHED` tolerated in the shared
  sets). Every list and filter uses those sets.
- Advancement slots are explicit in the generated templates (`nextMatchSlot` /
  `loserNextMatchSlot`); `matchOrder` parity is only a fallback for legacy rows.
- `scoreLimit` is always derived from `bestOf` (`floor(bestOf/2)+1`) — it can no longer drift.
  Best-of escalation is stage-relative ("last N rounds"), so it is correct at any bracket size.
- Match saves go through a pure decision module (`src/lib/match-result.ts`, unit-tested via
  `npm run test:bracket`): auto-complete, reopen, forfeit (`Match.resultType`), un-advance of a
  rolled-back result, and a 409 refusal when the downstream match has already started.
- Byes are created canonically completed.

**LAN floor operations**
- `POST /api/matches/[id]/load` = "Call match": `READY` + web push to both rosters + Discord +
  exactly one `NotificationLog` row + SSE broadcast.
- `Player.checkedInAt` + `POST /api/players/[id]/checkin` — shared, reload-proof "at seat" state,
  broadcast to every open board.
- Marshal board (`/marshal/dashboard`) with urgency ordering, seats, check-in, match calls, SSE.
- Player self-service: `PATCH /api/me/player` (seat, nickname — allowed even while the roster is
  locked, because seats move on the floor) and `DELETE /api/me/player` (leave team, with leader
  handover and empty-team cleanup, unlocked rosters only).
- Staff roster editing: `POST /api/teams/[id]/players`, `PATCH`/`DELETE /api/players/[id]`,
  `DELETE /api/teams/[id]?force=1`. Lock semantics are LAN-shaped: seats/names/nicknames/flags
  stay editable after the lock; changing *who plays* does not.
- Honest queue position for players ("you're up" / "you're on now").

**Integrations & presentation**
- EON live-score bridge: per-tournament token minted in Control, EON pushes from the observer
  machine, the match is identified from the steamids on the server so scores survive side swaps.
- Web push (VAPID) and Discord (webhook or bot token), both best-effort and both logged.
- One persistent role-aware header; the whole app unified on the Subtick design system; a real
  public landing page at `/`; editable bracket settings with a confirmed regenerate.

---

## 2. Known limitations

Accepted for this LAN — documented so nobody rediscovers them at 22:00 on match night.

- **Double elimination is power-of-two only.** 4 / 8 / 16 / 32 teams. Anything else is refused at
  generation with a message telling the organizer how many teams to add. Single elimination
  handles any count >= 2 with byes.
- **No bracket reset in double elimination.** If the lower-bracket team wins the grand final
  there is no second set; the grand final is a single series.
- **SQLite, single process.** Fine for a LAN, but there is no second app instance and no
  concurrent-writer story beyond SQLite's own locking.
- **The event bus is in-process.** SSE clients are served by whichever process emitted the event,
  so the deployment must stay a single container. Two replicas would silently split live updates.
- **Tournaments with "Require Steam Sign-in" off do not link player rows to users.** The manual
  roster form and the CSV import create `Player` rows with no `userId`, so those players get no
  web push, no "my team" self-service and no queue view. They still work for brackets, seats and
  the EON bridge (which keys off `steamId`).
- **`IN_PROGRESS` is not part of the vocabulary** but is still special-cased in a few display
  paths (`PublicBracket`, `TournamentView`, `ui/Badge`, the bracket overlay) and in the CS2
  webhook's active-status list. Nothing writes it today; it is dead weight that reads as if it
  were supported.
- **`Player` has no `createdAt`.** Leader promotion on "leave team" orders by `updatedAt` as the
  closest available proxy for "earliest joined", which is wrong once a row has been edited.
- **`ADMIN_STEAMID` (singular) is still honoured** as a fallback for `ADMIN_STEAMIDS`. Harmless,
  but it is a second spelling of a security-relevant setting.

---

## 3. Remaining work

Ordered by how much it would hurt to skip.

1. **e2e coverage for the paths that must not break on the day.** The Playwright suite covers
   navigation and LAN personas; it does not cover registration (create team -> invite -> join ->
   seat), scoring (map scores -> auto-complete -> advance -> correct a result -> 409), or the
   auth/role boundaries (a player hitting a staff route, staff vs public payload shapes).
2. **Typed API contracts.** Request and response bodies are hand-parsed `any` in most handlers,
   and the public/staff shaping is duplicated between the routes and `src/lib/api.ts` by
   convention alone. A shared schema (or at least shared shaping types) would make the mirror
   rule enforceable instead of reviewable.
3. **Byes in double elimination.** Lifts the power-of-two restriction, which is the single most
   likely thing to bite an organizer at check-in time.
4. **`Player.createdAt`.** A one-field migration that makes leader promotion (and any future
   join-order logic) correct.
5. **Retire `IN_PROGRESS`.** Delete the display special-cases and drop it from the CS2 webhook's
   active-status list, leaving `src/lib/match-status.ts` as the only vocabulary.
6. **Nice to have:** a QR code for the registration link (organizers currently generate one
   externally), and a "reset this match" control so clearing a downstream match after a 409 is a
   single click instead of a manual status + score edit.
