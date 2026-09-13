# Summit 🎯

**LAN tournament control for CS2 (and other team esports).** Brackets, floor operations, live
scores and an OBS overlay, run from one dark-mode control surface.

Running an event? Go straight to the **[LAN day runbook](docs/LAN-RUNBOOK.md)**.
Project status and remaining work: **[ANALYSIS_AND_ROADMAP.md](ANALYSIS_AND_ROADMAP.md)**.
Design language: **[design.md](design.md)**.

---

## Features

- 🔐 **Steam sign-in for everything** — no anonymous registration, no admin password. Roles are
  identities: `ADMIN_STEAMIDS` → organizer, `MARSHAL_STEAMIDS` → floor staff, everyone else is a
  player.
- 🏆 **Single & double elimination** — meet-in-the-middle seeding, byes in single elimination,
  optional 3rd-place decider. (Double elimination currently needs a power-of-two team count.)
- 🎮 **Per-stage BO1 / BO3 / BO5** — stage-relative ("BO3 from Semi-Finals, BO5 for the Grand
  Final"); the series win condition is always derived from best-of.
- 📝 **Score entry with map scores** — series score plus one row per map, auto-advance on the win
  condition, and un-advance when a result is corrected (guarded: a downstream match that has
  already started must be reset first).
- 🏳️ **Forfeit / walkover** — the match is marked final by forfeit and the opponent advances.
- 📣 **Call match** — one action sets the match to *Called*, web-pushes both rosters, posts to
  Discord and writes the in-app notification feed.
- 🪑 **Seats and check-in** — players set their own seat (editable even after the bracket locks);
  floor staff confirm "at seat" on a shared, live marshal board.
- 🖥️ **Marshal board** — `/marshal/dashboard`: matches needing players, sorted by urgency, with
  seats, check-in and the match-call feed. Live over SSE.
- 📡 **EON live-score bridge** — per-tournament token; EON on the observer machine pushes CS2
  scores in and Summit keeps them (side swaps included). Legacy GSI sources can still POST to
  `/api/webhooks/cs2`.
- 📺 **OBS overlays** — bracket and roster browser sources with chroma/compact flags.
- 🔒 **Public vs staff payloads** — invite codes, steamids, user ids, server credentials and the
  EON bridge token are never in a public response or an SSR page payload.
- 💾 **Verified backups** — `scripts/backup.sh`: consistent SQLite snapshot + uploads archive,
  integrity-checked, pruned.
- 🐳 **Docker deploy** — one command, loopback bind behind the Cloudflare tunnel.

---

## Getting Started

**Prerequisites:** Node.js 22+ (the Docker image is `node:22-alpine`)

```bash
npm install
cp .env.example .env   # fill in at least NEXTAUTH_SECRET, ADMIN_STEAMIDS, STEAM_API_KEY
npm run db:prepare
npm run dev
```

Open [http://localhost:4001](http://localhost:4001). The landing page lists tournaments and links
to your dashboard (or Steam sign-in). For local work without Steam, set `MOCK_AUTH_MODE=true` +
`NEXT_PUBLIC_MOCK_AUTH=true` to get persona buttons on `/login`.

### Checks

```bash
npx tsc --noEmit       # types
npm run lint           # eslint
npm run test:bracket   # bracket + match-result unit checks
npm run test:e2e       # Playwright (starts its own dev server on :4101)
```

### Docker

```bash
cp .env.example .env
docker compose up -d --build     # http://localhost:4001
```

`./data` → `/app/data` and `./uploads` → `/app/public/uploads` are bind-mounted, so data survives
rebuilds and stays readable on the host; Compose sets `DATABASE_URL` to `file:/app/data/prod.db`.
`docker compose down` stops it; `rm -rf data/prod.db* uploads` wipes it.

Production on `ash` (loopback `127.0.0.1:8089` behind the Cloudflare tunnel at
`turnering.mortenlab.xyz`):

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Summit is **public with its own Steam auth** — deliberately not behind Cloudflare Access, unlike
the other apps in `~/apps`.

### Backups

```bash
./scripts/backup.sh
```

* `data/backups/prod-<ts>.db` — consistent snapshot via SQLite `VACUUM INTO`, taken inside the
  `summit` container through the app's own Prisma client (neither the host nor the alpine image
  ships the `sqlite3` binary). Read-only with respect to the live DB: writers are never blocked.
* `data/backups/uploads-<ts>.tar.gz` — tar-gz of `./uploads`.
* Every snapshot is verified with `PRAGMA integrity_check`; a failed check deletes it and exits
  non-zero. Files older than `BACKUP_KEEP_DAYS` (default 30) are pruned. Other overrides:
  `BACKUP_DIR`, `SUMMIT_CONTAINER`, `SUMMIT_UPLOADS_DIR`, `SUMMIT_DB_IN_CONTAINER`.

Intended cron line (**not installed automatically** — add it with `crontab -e`):

```cron
20 3 * * * cd /home/mole/apps/Summit && ./scripts/backup.sh >> data/backups/backup.log 2>&1
```

Restore steps are in the `RESTORE` block at the top of `scripts/backup.sh`, and in the
[runbook](docs/LAN-RUNBOOK.md#g-troubleshooting).

---

## Environment Variables

Copy `.env.example` (which carries the full annotated list) to `.env` and keep it out of git.

**Required**

| Variable | Description |
|---|---|
| `NEXTAUTH_URL` | Public origin; drives the Steam realm / return URL. Set by the prod compose file. |
| `NEXTAUTH_SECRET` | Signs session cookies (`openssl rand -hex 32`). |
| `STEAM_API_KEY` | Steam Web API key. Without it nobody can sign in. |
| `ADMIN_STEAMIDS` | Comma-separated steamid64 allowlist → organizers. |
| `DATABASE_URL` | SQLite path. Docker sets it to the mounted volume. |

**Operational**

| Variable | Description |
|---|---|
| `MARSHAL_STEAMIDS` | Comma-separated steamid64 allowlist → floor staff (match control, no settings). |
| `CS2_WEBHOOK_KEY` | Bearer key for `POST /api/webhooks/cs2`. Fails closed (503) if unset. |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web push (`npx web-push generate-vapid-keys`). Blank disables push and hides the opt-in button. |
| `DISCORD_WEBHOOK_URL` *or* `DISCORD_BOT_TOKEN` + `DISCORD_CHANNEL_ID` | Announcements. Neither set → in-app notification log only. |
| `PORT` | Server port (default `4001`). |

The EON bridge needs **no** env var: enable it per tournament in Control and paste the generated
endpoint + token into EON on the observer machine.

---

## Usage

### 1. Create a tournament

`/admin` → **Create Tournament** → wizard: game, name, bracket style (single/double), team size,
3rd-place decider, BO3/BO5 starting stage, review. Everything stays editable in **Settings**, but
changing format / team size / best-of does not reshape matches that already exist — regenerate.

### 2. Open registration

**Settings → Signup Rules → Require Steam Sign-in** (off by default) turns on the self-service
flow, and **Roster lock** must be *Editable*. Share
`/tournaments/<id>/register`. Players sign in with Steam, create a team or join via the leader's
invite link, and set their seat. Organizers can add, edit and remove teams, players and seats at
any time, and import/export rosters as CSV
(`teamName,seed,playerName,nickname,countryCode,seating,steamId,isLeader`).

### 3. Generate the bracket

Locks roster edits and seeds round 1. Double elimination needs 4/8/16/32 teams; single
elimination handles any count and fills with byes. **Regenerating deletes all matches and
results.**

### 4. Run the event

Organizers work in the **Control** cockpit (`/admin/tournaments/<id>`), floor staff on the
**marshal board** (`/marshal/dashboard`): call matches, check players in at their seat, mark live,
enter series and map scores, record forfeits, correct results. Optionally enable the **EON live
scores** bridge so scores arrive on their own.

Step-by-step, including the failure modes: **[docs/LAN-RUNBOOK.md](docs/LAN-RUNBOOK.md)**.

---

## OBS Stream Overlay

Public browser sources, no login, polling every 10s:

```
/bracket/<tournamentId>/overlay   # bracket + live scores
/bracket/<tournamentId>/roster    # rosters with seats
```

| Flag | Values | Default | Description |
|---|---|---|---|
| `chroma` | `transparent`, any CSS colour | `transparent` | Overlay background (`?chroma=green`, `?chroma=%2300b140`) |
| `compact` | `true` | *(off)* | Bracket overlay at 75% scale |

In OBS: add a **Browser Source**, set 1920×1080, tick **"Refresh browser when scene becomes
active"**, and add `body { background-color: rgba(0,0,0,0) !important; }` to Custom CSS as a
transparency safety net.

---

## Live scores (inbound)

| Endpoint | Auth | Source |
|---|---|---|
| `POST /api/webhooks/eon` | per-tournament bridge token (`Authorization: Bearer eon_…`) | EON on the observer machine; identifies the match from the steamids on the server, so side swaps are handled |
| `POST /api/webhooks/cs2` | `Authorization: Bearer $CS2_WEBHOOK_KEY` | any CS2 GSI relay |

Both update match state and broadcast to the live UI over SSE. Staff can always override scores
from Control — and always decide when a match is *Final*.

```bash
npm run test:cs2-webhook -- match_live <matchId>   # local smoke test
```

---

## Project Structure

```
src/
  app/
    admin/                # organizer dashboard + tournament cockpit
    marshal/dashboard/    # floor board
    tournaments/          # public + player pages (incl. /register)
    bracket/[id]/         # overlay/ and roster/ OBS sources
    api/                  # route handlers (public vs staff payload shapes)
  lib/
    bracket-utils.ts      # bracket generation + seeding
    match-status.ts       # canonical match status vocabulary
    match-result.ts       # pure score/forfeit/advance decision logic
    api.ts                # SSR prefetch — mirrors the routes' public shapes
    push.ts discord.ts    # notification channels
prisma/schema.prisma
scripts/backup.sh         # snapshot + restore instructions
docs/LAN-RUNBOOK.md
```

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| UI | React 19 + Tailwind CSS |
| Bracket visualisation | React Flow |
| Auth | next-auth v4 + `next-auth-steam` |
| Database | SQLite via Prisma 6 |
| Live updates | SSE over an in-process event bus |
| Runtime | Node.js 22 |
| Container | Docker + Docker Compose |
