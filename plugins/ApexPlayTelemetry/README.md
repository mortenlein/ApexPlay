# ApexPlayTelemetry Plugin (Scaffold)

This is a CounterStrikeSharp plugin scaffold for sending CS2 events to:

- `POST /api/webhooks/cs2`

## Build requirement

- .NET SDK 8.0+ is required (`CounterStrikeSharp.API` targets `net8.0`).

## What it does

- Sends core events (`match_live`, `round_end`, `player_connect`, `player_disconnect`, `heartbeat`)
- Sends frequent `player_snapshot` events with side + K/D/A per connected player
- Emits `team_change` events when a player switches between `T`, `CT`, `SPEC`, `UNKNOWN`
- Emits `player_death` events for kill-feed style integrations
- Adds `Authorization: Bearer <WebhookKey>`
- Uses JSON payloads compatible with ApexPlay's CS2 webhook route
- Supports deterministic match context via server console command:
  - `apexplay_set_match "<matchId>" "<tournamentId>" "<homeTeamName>" "<awayTeamName>"`
  - `apexplay_clear_match`

## Config

`ApexPlayTelemetryConfig.cs` defines:

- `WebhookUrl`
- `WebhookKey`
- `HttpTimeoutMs`
- `MaxQueueSize`
- `MaxRetryAttempts`
- `RetryBaseDelayMs`
- `RetryMaxDelayMs`
- `EnableHeartbeat`
- `HeartbeatIntervalSeconds`
- `EnablePlayerSnapshots`
- `PlayerSnapshotIntervalSeconds`

## DatHost deployment (CounterStrikeSharp)

1. Build with .NET 8:

```bash
dotnet restore
dotnet build -c Release
```

2. Upload `ApexPlayTelemetry.dll` to:
   - `csgo/addons/counterstrikesharp/plugins/ApexPlayTelemetry/`

3. Create/update config file:
   - `csgo/addons/counterstrikesharp/configs/plugins/ApexPlayTelemetry/ApexPlayTelemetry.json`

Example config:

```json
{
  "WebhookUrl": "https://<your-apexplay-domain>/api/webhooks/cs2",
  "WebhookKey": "<your-CS2_WEBHOOK_KEY>",
  "HttpTimeoutMs": 3000,
  "MaxQueueSize": 500,
  "MaxRetryAttempts": 6,
  "RetryBaseDelayMs": 500,
  "RetryMaxDelayMs": 10000,
  "EnableHeartbeat": true,
  "HeartbeatIntervalSeconds": 20,
  "EnablePlayerSnapshots": true,
  "PlayerSnapshotIntervalSeconds": 2
}
```

4. Restart server.
5. Bind current match context through RCON:

```txt
apexplay_set_match "<matchId>" "<tournamentId>" "<homeTeamName>" "<awayTeamName>"
```

6. Verify webhook receives:
   - `heartbeat`
   - `player_snapshot`
   - `team_change`
   - `player_death`

## Important

- CounterStrikeSharp event APIs vary by version and server distro.
- Treat this as a bootstrap scaffold and adapt event handlers to your runtime.
- Match-level IDs (`matchId`, `tournamentId`) should be injected once you have a deterministic source (for example from your match orchestrator or custom server command args).
- Chat + detailed damage telemetry can be added next if needed, but side/roster sync is now plugin-driven.

## Deterministic match binding

When `Load Match` is triggered in ApexPlay and `ENABLE_CS2_PLUGIN=true`,
the backend sends a console command to bind plugin context:

```txt
apexplay_set_match "<matchId>" "<tournamentId>" "<homeTeamName>" "<awayTeamName>"
```

This allows webhook events to include IDs directly and avoids ambiguous team-name matching.

## Local test payload

```json
{
  "event": "match_live",
  "matchId": "b864630c-2f7a-4253-8549-76dee0e9bdba",
  "timestamp": "2026-04-07T10:00:00Z"
}
```

Post it to:

- `http://localhost:4001/api/webhooks/cs2`

with:

- `Authorization: Bearer <CS2_WEBHOOK_KEY>`
