using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using CounterStrikeSharp.API;
using CounterStrikeSharp.API.Core;
using CounterStrikeSharp.API.Modules.Commands;
using CounterStrikeSharp.API.Modules.Timers;
using Microsoft.Extensions.Logging;

namespace ApexPlayTelemetry;

public sealed class ApexPlayTelemetryPlugin : BasePlugin, IPluginConfig<ApexPlayTelemetryConfig>
{
    public override string ModuleName => "ApexPlayTelemetry";
    public override string ModuleVersion => "0.1.0";
    public override string ModuleAuthor => "ApexPlay";
    public override string ModuleDescription => "Sends CS2 match telemetry to ApexPlay webhook endpoint.";

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private HttpClient _httpClient = new();
    private ApexPlayTelemetryConfig _config = new();
    private CounterStrikeSharp.API.Modules.Timers.Timer? _heartbeatTimer;
    private CounterStrikeSharp.API.Modules.Timers.Timer? _deliveryTimer;
    private CounterStrikeSharp.API.Modules.Timers.Timer? _playerSnapshotTimer;
    private string? _activeMatchId;
    private string? _activeTournamentId;
    private string? _activeHomeTeamName;
    private string? _activeAwayTeamName;
    private readonly object _queueLock = new();
    private readonly List<QueuedEvent> _queue = new();
    private readonly SemaphoreSlim _drainGate = new(1, 1);
    private readonly object _statsLock = new();
    private readonly Dictionary<string, string> _lastKnownPlayerTeams = new();
    private readonly Dictionary<string, PlayerLiveStats> _playerStats = new();
    public ApexPlayTelemetryConfig Config { get; set; } = new();

    private sealed class QueuedEvent
    {
        public required string Json { get; init; }
        public int Attempt { get; init; }
        public required DateTimeOffset NotBeforeUtc { get; init; }
        public required DateTimeOffset CreatedUtc { get; init; }
    }

    private sealed class PlayerLiveStats
    {
        public int Kills { get; set; }
        public int Deaths { get; set; }
        public int Assists { get; set; }
    }

    public void OnConfigParsed(ApexPlayTelemetryConfig config)
    {
        Config = config;
        _config = config;
        _httpClient.Dispose();
        _httpClient = new HttpClient
        {
            Timeout = TimeSpan.FromMilliseconds(Math.Max(1000, _config.HttpTimeoutMs)),
        };
    }

    public override void Load(bool hotReload)
    {
        RegisterHandlers();
        StartHeartbeat();
        StartDeliveryLoop();
        StartPlayerSnapshots();
        Logger.LogInformation("[ApexPlayTelemetry] Plugin loaded.");
    }

    public override void Unload(bool hotReload)
    {
        _heartbeatTimer?.Kill();
        _deliveryTimer?.Kill();
        _playerSnapshotTimer?.Kill();
        _httpClient.Dispose();
        _drainGate.Dispose();
    }

    private void RegisterHandlers()
    {
        AddCommand("apexplay_set_match", "Bind active ApexPlay match context: <matchId> <tournamentId> [homeTeam] [awayTeam]", HandleSetMatchCommand);
        AddCommand("apexplay_clear_match", "Clear active ApexPlay match context", HandleClearMatchCommand);
        AddCommand("apexplay_test_webhook", "Send a test webhook payload to ApexPlay", HandleTestWebhookCommand);

        // NOTE:
        // Event names and payload detail differ between CSSharp versions and installed plugins.
        // Keep this scaffold and adapt these handlers to your server's available events.
        RegisterEventHandler<EventRoundStart>((@event, _) =>
        {
            EnqueueEvent(new
            {
                @event = "match_live",
                timestamp = DateTimeOffset.UtcNow,
                matchId = _activeMatchId,
                tournamentId = _activeTournamentId,
                team1 = new { name = _activeHomeTeamName },
                team2 = new { name = _activeAwayTeamName },
            });
            return HookResult.Continue;
        });

        RegisterEventHandler<EventRoundEnd>((@event, _) =>
        {
            EnqueueEvent(new
            {
                @event = "round_end",
                timestamp = DateTimeOffset.UtcNow,
                matchId = _activeMatchId,
                tournamentId = _activeTournamentId,
                team1 = new { name = _activeHomeTeamName, score = @event.Winner == 2 ? 1 : 0 },
                team2 = new { name = _activeAwayTeamName, score = @event.Winner == 3 ? 1 : 0 },
            });
            return HookResult.Continue;
        });

        RegisterEventHandler<EventPlayerDeath>((@event, _) =>
        {
            var victimSteamId = TryGetSteamIdFromEventUser(@event, "Userid");
            var attackerSteamId = TryGetSteamIdFromEventUser(@event, "Attacker");
            var assisterSteamId = TryGetSteamIdFromEventUser(@event, "Assister");

            lock (_statsLock)
            {
                if (!string.IsNullOrWhiteSpace(attackerSteamId) && attackerSteamId != victimSteamId)
                {
                    var stats = GetOrCreateStats(attackerSteamId!);
                    stats.Kills += 1;
                }

                if (!string.IsNullOrWhiteSpace(victimSteamId))
                {
                    var stats = GetOrCreateStats(victimSteamId!);
                    stats.Deaths += 1;
                }

                if (!string.IsNullOrWhiteSpace(assisterSteamId) && assisterSteamId != attackerSteamId)
                {
                    var stats = GetOrCreateStats(assisterSteamId!);
                    stats.Assists += 1;
                }
            }

            EnqueueEvent(new
            {
                @event = "player_death",
                timestamp = DateTimeOffset.UtcNow,
                matchId = _activeMatchId,
                tournamentId = _activeTournamentId,
                victim = new { steamId = victimSteamId },
                attacker = new { steamId = attackerSteamId },
                assister = new { steamId = assisterSteamId },
            });

            EmitPlayerSnapshot();
            return HookResult.Continue;
        });

        RegisterEventHandler<EventPlayerConnectFull>((@event, _) =>
        {
            if (@event.Userid?.SteamID == null) return HookResult.Continue;
            EnqueueEvent(new
            {
                @event = "player_connect",
                timestamp = DateTimeOffset.UtcNow,
                matchId = _activeMatchId,
                tournamentId = _activeTournamentId,
                team1 = new { name = _activeHomeTeamName },
                team2 = new { name = _activeAwayTeamName },
                player = new
                {
                    steamId = @event.Userid.SteamID.ToString(),
                    name = @event.Userid.PlayerName,
                },
            });
            EmitPlayerSnapshot();
            return HookResult.Continue;
        });

        RegisterEventHandler<EventPlayerDisconnect>((@event, _) =>
        {
            if (@event.Userid?.SteamID == null) return HookResult.Continue;
            EnqueueEvent(new
            {
                @event = "player_disconnect",
                timestamp = DateTimeOffset.UtcNow,
                matchId = _activeMatchId,
                tournamentId = _activeTournamentId,
                team1 = new { name = _activeHomeTeamName },
                team2 = new { name = _activeAwayTeamName },
                player = new
                {
                    steamId = @event.Userid.SteamID.ToString(),
                    name = @event.Userid.PlayerName,
                },
            });
            EmitPlayerSnapshot();
            return HookResult.Continue;
        });
    }

    private void StartHeartbeat()
    {
        _heartbeatTimer?.Kill();
        if (!_config.EnableHeartbeat) return;

        _heartbeatTimer = AddTimer(
            Math.Max(5, _config.HeartbeatIntervalSeconds),
            () =>
            {
                EnqueueEvent(new
                {
                    @event = "heartbeat",
                    timestamp = DateTimeOffset.UtcNow,
                    plugin = ModuleName,
                    version = ModuleVersion,
                    matchId = _activeMatchId,
                    tournamentId = _activeTournamentId,
                });
            },
            TimerFlags.REPEAT
        );
    }

    private void StartDeliveryLoop()
    {
        _deliveryTimer?.Kill();
        _deliveryTimer = AddTimer(
            1f,
            () => { _ = FlushQueueAsync(); },
            TimerFlags.REPEAT
        );
    }

    private void StartPlayerSnapshots()
    {
        _playerSnapshotTimer?.Kill();
        if (!_config.EnablePlayerSnapshots) return;

        _playerSnapshotTimer = AddTimer(
            Math.Max(1, _config.PlayerSnapshotIntervalSeconds),
            EmitPlayerSnapshot,
            TimerFlags.REPEAT
        );
    }

    private void HandleSetMatchCommand(CCSPlayerController? caller, CommandInfo info)
    {
        if (info.ArgCount < 3)
        {
            Logger.LogWarning("[ApexPlayTelemetry] apexplay_set_match requires at least 2 args: <matchId> <tournamentId>");
            return;
        }

        _activeMatchId = info.GetArg(1);
        _activeTournamentId = info.GetArg(2);
        _activeHomeTeamName = info.ArgCount >= 4 ? info.GetArg(3) : null;
        _activeAwayTeamName = info.ArgCount >= 5 ? info.GetArg(4) : null;

        Logger.LogInformation(
            "[ApexPlayTelemetry] Bound match context matchId={MatchId}, tournamentId={TournamentId}, home={Home}, away={Away}",
            _activeMatchId,
            _activeTournamentId,
            _activeHomeTeamName ?? "n/a",
            _activeAwayTeamName ?? "n/a"
        );
    }

    private void HandleClearMatchCommand(CCSPlayerController? caller, CommandInfo info)
    {
        _activeMatchId = null;
        _activeTournamentId = null;
        _activeHomeTeamName = null;
        _activeAwayTeamName = null;
        lock (_statsLock)
        {
            _playerStats.Clear();
            _lastKnownPlayerTeams.Clear();
        }
        Logger.LogInformation("[ApexPlayTelemetry] Cleared active match context");
    }

    private void HandleTestWebhookCommand(CCSPlayerController? caller, CommandInfo info)
    {
        EnqueueEvent(new
        {
            @event = "heartbeat",
            timestamp = DateTimeOffset.UtcNow,
            plugin = ModuleName,
            version = ModuleVersion,
            source = "manual_test_command",
            matchId = _activeMatchId,
            tournamentId = _activeTournamentId,
            caller = caller?.PlayerName
        });

        Logger.LogInformation("[ApexPlayTelemetry] Manual webhook test event enqueued.");
    }

    private void EmitPlayerSnapshot()
    {
        var snapshotRows = new List<object>();
        Dictionary<string, string> currentTeams = new();
        List<(string SteamId, string Team, int TeamNum)> teamChanges = new();
        var now = DateTimeOffset.UtcNow;

        try
        {
            foreach (var player in Utilities.GetPlayers())
            {
                if (player == null || !player.IsValid)
                {
                    continue;
                }

                if (player.SteamID == 0)
                {
                    continue;
                }

                var steamId = player.SteamID.ToString();
                var teamNum = TryGetIntProperty(player, "TeamNum") ?? 0;
                var team = TeamNumToName(teamNum);
                currentTeams[steamId] = team;

                PlayerLiveStats? stats;
                lock (_statsLock)
                {
                    _playerStats.TryGetValue(steamId, out stats);
                }

                snapshotRows.Add(new
                {
                    steamId,
                    name = player.PlayerName,
                    team,
                    teamNum,
                    kills = stats?.Kills ?? 0,
                    deaths = stats?.Deaths ?? 0,
                    assists = stats?.Assists ?? 0,
                });
            }
        }
        catch (Exception ex)
        {
            Logger.LogWarning(ex, "[ApexPlayTelemetry] Failed to collect player snapshot");
            return;
        }

        lock (_statsLock)
        {
            foreach (var kvp in currentTeams)
            {
                if (!_lastKnownPlayerTeams.TryGetValue(kvp.Key, out var previousTeam) || !string.Equals(previousTeam, kvp.Value, StringComparison.Ordinal))
                {
                    teamChanges.Add((kvp.Key, kvp.Value, TeamNameToNum(kvp.Value)));
                }
            }
            _lastKnownPlayerTeams.Clear();
            foreach (var kvp in currentTeams)
            {
                _lastKnownPlayerTeams[kvp.Key] = kvp.Value;
            }
        }

        foreach (var change in teamChanges)
        {
            EnqueueEvent(new
            {
                @event = "team_change",
                timestamp = now,
                matchId = _activeMatchId,
                tournamentId = _activeTournamentId,
                player = new
                {
                    steamId = change.SteamId,
                    team = change.Team,
                    teamNum = change.TeamNum,
                },
            });
        }

        EnqueueEvent(new
        {
            @event = "player_snapshot",
            timestamp = now,
            matchId = _activeMatchId,
            tournamentId = _activeTournamentId,
            team1 = new { name = _activeHomeTeamName },
            team2 = new { name = _activeAwayTeamName },
            players = snapshotRows,
        });
    }

    private static PlayerLiveStats GetOrCreateStats(Dictionary<string, PlayerLiveStats> statsMap, string steamId)
    {
        if (!statsMap.TryGetValue(steamId, out var stats))
        {
            stats = new PlayerLiveStats();
            statsMap[steamId] = stats;
        }
        return stats;
    }

    private PlayerLiveStats GetOrCreateStats(string steamId)
    {
        return GetOrCreateStats(_playerStats, steamId);
    }

    private static string TeamNumToName(int teamNum)
    {
        return teamNum switch
        {
            2 => "T",
            3 => "CT",
            1 => "SPEC",
            _ => "UNKNOWN",
        };
    }

    private static int TeamNameToNum(string teamName)
    {
        return teamName switch
        {
            "T" => 2,
            "CT" => 3,
            "SPEC" => 1,
            _ => 0,
        };
    }

    private static int? TryGetIntProperty(object source, string propertyName)
    {
        var value = source.GetType().GetProperty(propertyName)?.GetValue(source);
        if (value == null) return null;
        if (value is int i) return i;
        if (int.TryParse(value.ToString(), out var parsed)) return parsed;
        return null;
    }

    private static string? TryGetSteamIdFromEventUser(object gameEvent, string propertyName)
    {
        var userValue = gameEvent.GetType().GetProperty(propertyName)?.GetValue(gameEvent);
        if (userValue == null) return null;

        if (userValue is CCSPlayerController controller)
        {
            if (controller.SteamID == 0) return null;
            return controller.SteamID.ToString();
        }

        var steamIdValue = userValue.GetType().GetProperty("SteamID")?.GetValue(userValue);
        if (steamIdValue == null) return null;
        if (ulong.TryParse(steamIdValue.ToString(), out var steamId) && steamId != 0UL)
        {
            return steamId.ToString();
        }

        return null;
    }

    private void EnqueueEvent(object payload)
    {
        if (string.IsNullOrWhiteSpace(_config.WebhookUrl))
        {
            return;
        }

        try
        {
            var json = JsonSerializer.Serialize(payload, JsonOptions);
            var now = DateTimeOffset.UtcNow;
            lock (_queueLock)
            {
                if (_queue.Count >= Math.Max(50, _config.MaxQueueSize))
                {
                    _queue.RemoveAt(0);
                }

                _queue.Add(new QueuedEvent
                {
                    Json = json,
                    Attempt = 0,
                    NotBeforeUtc = now,
                    CreatedUtc = now,
                });
            }

            _ = FlushQueueAsync();
        }
        catch (Exception ex)
        {
            Logger.LogWarning(ex, "[ApexPlayTelemetry] Failed to enqueue webhook event");
        }
    }

    private async Task FlushQueueAsync()
    {
        if (!await _drainGate.WaitAsync(0).ConfigureAwait(false))
        {
            return;
        }

        try
        {
            while (true)
            {
                QueuedEvent? queued = null;
                lock (_queueLock)
                {
                    if (_queue.Count == 0)
                    {
                        return;
                    }

                    var first = _queue[0];
                    if (first.NotBeforeUtc > DateTimeOffset.UtcNow)
                    {
                        return;
                    }

                    queued = first;
                    _queue.RemoveAt(0);
                }

                var delivered = await TrySendJsonAsync(queued.Json).ConfigureAwait(false);
                if (delivered)
                {
                    continue;
                }

                var nextAttempt = queued.Attempt + 1;
                if (nextAttempt > Math.Max(1, _config.MaxRetryAttempts))
                {
                    Logger.LogWarning("[ApexPlayTelemetry] Dropping event after {Attempts} failed attempts", nextAttempt);
                    continue;
                }

                var retryDelay = ComputeRetryDelay(nextAttempt);
                var retryItem = new QueuedEvent
                {
                    Json = queued.Json,
                    Attempt = nextAttempt,
                    NotBeforeUtc = DateTimeOffset.UtcNow.Add(retryDelay),
                    CreatedUtc = queued.CreatedUtc,
                };

                lock (_queueLock)
                {
                    _queue.Insert(0, retryItem);
                }

                return;
            }
        }
        finally
        {
            _drainGate.Release();
        }
    }

    private TimeSpan ComputeRetryDelay(int attempt)
    {
        var baseMs = Math.Max(100, _config.RetryBaseDelayMs);
        var maxMs = Math.Max(baseMs, _config.RetryMaxDelayMs);
        var exp = Math.Min(10, attempt);
        var delay = Math.Min(maxMs, baseMs * (1 << exp));
        return TimeSpan.FromMilliseconds(delay);
    }

    private async Task<bool> TrySendJsonAsync(string json)
    {
        try
        {
            using var req = new HttpRequestMessage(HttpMethod.Post, _config.WebhookUrl);
            req.Content = new StringContent(json, Encoding.UTF8, "application/json");
            if (!string.IsNullOrWhiteSpace(_config.WebhookKey))
            {
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _config.WebhookKey);
            }

            using var res = await _httpClient.SendAsync(req).ConfigureAwait(false);
            if (res.IsSuccessStatusCode)
            {
                return true;
            }

            Logger.LogWarning("[ApexPlayTelemetry] Webhook rejected with status code {StatusCode}", (int)res.StatusCode);
            return false;
        }
        catch (Exception ex)
        {
            Logger.LogWarning(ex, "[ApexPlayTelemetry] Failed to deliver webhook event");
            return false;
        }
    }
}
