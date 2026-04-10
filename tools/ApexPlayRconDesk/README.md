# ApexPlay RCON Desk (Windows)

Desktop control panel for CS2 RCON operations with fast buttons and hotkeys.

## Features

- Server profiles (`host`, `port`, `rcon password`, `server password`)
- Connect/disconnect session control
- Preset action buttons with hotkeys
- Macro editor (multi-line or `;` separated commands)
- Live output log panel
- One-click join link copy (`steam://connect/host:port/password`)
- Confirmation prompts for dangerous actions

## Build and run

```powershell
dotnet build tools/ApexPlayRconDesk/ApexPlayRconDesk.csproj
dotnet run --project tools/ApexPlayRconDesk/ApexPlayRconDesk.csproj
```

## Settings

Saved at:

- `%APPDATA%\ApexPlayRconDesk\settings.json`

Includes:

- Server profiles
- Last selected server
- Action presets + hotkeys

## Hotkey notes

- Hotkeys are app-window hotkeys (work while the app has focus).
- Default examples: `F1`, `F2`, `F3`, `F4`, `Ctrl+1`, `Ctrl+2`, `Ctrl+K`, `Ctrl+E`.

## Safety

- RCON commands execute directly on the game server.
- Keep confirmation enabled for destructive actions (`restart`, force-end, etc.).
