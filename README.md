# ApexPlay 🎯

**Streamer-first tournament bracket management for CS2 (and any team-based esport).**

ApexPlay lets you create and manage single-elimination brackets, track live match scores, and display a real-time OBS overlay — all from a clean, dark-mode dashboard.

---

## Features

- 📋 **Dashboard** — Create and manage multiple tournaments
- 🏆 **Bracket Generator** — Automatic single-elimination seeding with standard meet-in-the-middle seeding
- 🎮 **BO1 / BO3 / BO5** — Per-round best-of format support (e.g. BO3 from Semi-Finals, BO5 for Grand Final)
- 🎯 **3rd Place Decider** — Optional third place match
- 🖥️ **OBS Overlay** — Live browser source overlay with transparent/chroma key background, auto-refreshing every 10s
- 🏷️ **Stage Badges** — Every round labelled (Grand Final, Semi-Finals, Quarter-Finals, Round of 16, etc.)
- 📝 **Score Tracking** — Per-map scores tracked alongside series scores
- 🐳 **Docker Support** — Single command to run via Docker Compose

---

## Getting Started

### Local Development

**Prerequisites:** Node.js 20+

```bash
npm install
npm run db:prepare
npm run dev
```

Open [http://localhost:4001](http://localhost:4001) — it auto-redirects to the dashboard.

### Docker

```bash
docker compose up --build
```

The app will be available at [http://localhost:4001](http://localhost:4001).

The SQLite database is persisted to a named Docker volume (`apexplay_data`) so your data survives container restarts.

To stop:
```bash
docker compose down
```

To wipe data completely:
```bash
docker compose down -v
```

---

## Environment Variables

| Variable | Default (dev) | Description |
|---|---|---|
| `DATABASE_URL` | `file:./dev.db` | Path to the SQLite database file |
| `PORT` | `4001` | Port the server listens on |
| `CS2_WEBHOOK_KEY` | *(required for CS2 plugin webhook auth)* | Bearer key expected by `/api/webhooks/cs2` |
| `ENABLE_CS2_PLUGIN` | `false` | When true, `Load Match` binds match context in plugin via console command |
| `CS2_PLUGIN_SET_MATCH_COMMAND` | `apexplay_set_match` | Server command used to bind `matchId`/`tournamentId` in plugin |

For local dev, these are set in `.env`. Docker Compose sets `DATABASE_URL` automatically to point to the persistent volume.

---

## CS2 Plugin Telemetry (Full Path)

This repo includes a CounterStrikeSharp plugin scaffold and webhook receiver:

- Plugin scaffold: `plugins/ApexPlayTelemetry`
- Webhook endpoint: `POST /api/webhooks/cs2`

Plugin build target: `.NET 8` (`CounterStrikeSharp.API`).

### Flow

1. Admin clicks **Load Match**
2. ApexPlay sends server command:
   - `apexplay_set_match "<matchId>" "<tournamentId>" "<homeTeamName>" "<awayTeamName>"`
3. Plugin emits signed events to `/api/webhooks/cs2`
4. API updates match/player state and broadcasts to live UI streams

### Quick local webhook test

```bash
npm run test:cs2-webhook -- match_live <matchId>
```

---

## Usage

### Creating a Tournament

1. Go to the **Dashboard** at `/dashboard`
2. Click **Create Tournament**
3. Configure:
   - **Tournament Name**
   - **Bracket Format** — Single or Double Elimination
   - **Team Size** — 2v2 (Duos) or 5v5 (Standard)
   - **BO3 Starts At Round** — Stage from which matches become Best-of-3
   - **BO5 Starts At Round** — Stage from which matches become Best-of-5
   - **3rd Place Decider** — Enable a third place match

### BO3 / BO5 Stage Dropdown Options

| Option | Description |
|---|---|
| None | BO1 for all rounds (default) |
| Grand Final | Only the final match is BO3/BO5 |
| Semi-Finals | Semi-finals and the final are BO3/BO5 |
| Quarter-Finals | From quarters onward |
| Round of 16 | From Ro16 onward |

> BO5 will override BO3 for the same or later rounds. For example: BO3 from Semi-Finals + BO5 from Grand Final = Semis are BO3, Grand Final is BO5.

### Managing a Tournament

From the tournament card, click **Manage** to:

- Add/edit teams and players
- Generate the bracket
- Record match scores (per-map and series scores)
- Advance winners and manage bracket state

---

## OBS Stream Overlay

The overlay is a browser source designed for OBS Studio (or any browser-source-capable capturing tool).

### Overlay URL

```
http://localhost:4001/bracket/[tournament-id]/overlay
```

Find the tournament ID in the URL when managing a tournament.

### Query String Flags

| Flag | Values | Default | Description |
|---|---|---|---|
| `chroma` | `transparent`, any CSS colour | `transparent` | Background colour of the overlay |
| `compact` | `true` | *(off)* | Scales the overlay to 75% for smaller displays |

### Background Examples

| URL | Effect |
|---|---|
| `/overlay` | Fully transparent (for OBS chroma key or direct compositing) |
| `/overlay?chroma=green` | Solid green background |
| `/overlay?chroma=%2300b140` | Custom hex green (`#00b140`) |
| `/overlay?chroma=%23ff00ff` | Magenta/pink chroma key |
| `/overlay?compact=true` | 75% scale, transparent background |
| `/overlay?chroma=green&compact=true` | 75% scale, green background |

### OBS Setup

1. Add a **Browser Source** in OBS
2. Set the URL to your overlay (with the tournament ID)
3. Set width/height to match your canvas (e.g. 1920×1080)
4. Check **"Refresh browser when scene becomes active"** for reliable updates
5. In the **Custom CSS** field, add:
   ```css
   body { background-color: rgba(0,0,0,0) !important; }
   ```
   as an extra safety net for transparency

The overlay polls for score updates every **10 seconds** automatically.

---

## Project Structure

```
src/
  app/
    dashboard/          # Dashboard and tournament management UI
    bracket/[id]/
      overlay/          # OBS stream overlay
    api/
      tournaments/      # Tournament CRUD and bracket generation APIs
  lib/
    bracket-utils.ts    # Bracket generation and seeding logic
    prisma.ts           # Prisma client singleton
prisma/
  schema.prisma         # Database schema
```

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| UI | React + Tailwind CSS |
| Bracket Visualisation | React Flow |
| Database | SQLite via Prisma |
| Runtime | Node.js 20 |
| Container | Docker + Docker Compose |
