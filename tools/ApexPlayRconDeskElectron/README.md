# ApexPlay RCON Desk (Electron)

Electron desktop app for CS2 admin operations over RCON with hotkeys and macros.

## Features

- Server profiles with:
  - Host/IP
  - Port
  - Public Log URL override (optional)
  - Server password (`sv_password`) for join-link generation
  - RCON password (`rcon_password`) for admin commands
- Connect/disconnect to Source RCON
- Quick action buttons with hotkeys
- Macro editor and manual command input
- Live log/output view
- Parsed server overview + live player table from `status` output
- Isolated chat feed via CS2 HTTP server log forwarding (`logaddress_add_http`)
- Global hotkeys (registered via Electron `globalShortcut`)
- One-click `Copy Join Link`

## Run

```powershell
cd tools/ApexPlayRconDeskElectron
npm install
npm run dev
```

## Notes

- Join link format: `steam://connect/<host>:<port>/<serverPassword>`
- RCON auth still uses the separate `rcon_password`.
- Chat feed requires the game server to reach your listener HTTP endpoint.
