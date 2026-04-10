using System.Text.Json;
using ApexPlayRconDesk.Models;
using System.IO;

namespace ApexPlayRconDesk.Services;

public sealed class SettingsService
{
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true
    };

    public string SettingsPath { get; }

    public SettingsService()
    {
        var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        var dir = Path.Combine(appData, "ApexPlayRconDesk");
        Directory.CreateDirectory(dir);
        SettingsPath = Path.Combine(dir, "settings.json");
    }

    public AppSettings Load()
    {
        try
        {
            if (!File.Exists(SettingsPath))
            {
                var defaults = CreateDefaultSettings();
                Save(defaults);
                return defaults;
            }

            var json = File.ReadAllText(SettingsPath);
            var loaded = JsonSerializer.Deserialize<AppSettings>(json, _jsonOptions);
            if (loaded == null)
            {
                return CreateDefaultSettings();
            }
            if (loaded.Servers.Count == 0)
            {
                loaded.Servers = CreateDefaultSettings().Servers;
            }
            if (loaded.Actions.Count == 0)
            {
                loaded.Actions = CreateDefaultSettings().Actions;
            }
            return loaded;
        }
        catch
        {
            return CreateDefaultSettings();
        }
    }

    public void Save(AppSettings settings)
    {
        var json = JsonSerializer.Serialize(settings, _jsonOptions);
        File.WriteAllText(SettingsPath, json);
    }

    private static AppSettings CreateDefaultSettings()
    {
        return new AppSettings
        {
            Servers = new List<ServerProfile>
            {
                new()
                {
                    Name = "DatHost CS2",
                    Host = "sul.ggwp.cc",
                    Port = 25923,
                    ServerPassword = "",
                    RconPassword = ""
                }
            },
            LastServerName = "DatHost CS2",
            Actions = new List<ActionPreset>
            {
                new() { Name = "Live On", CommandScript = "mp_warmup_end", Hotkey = "F1" },
                new() { Name = "Pause", CommandScript = "mp_pause_match", Hotkey = "F2" },
                new() { Name = "Unpause", CommandScript = "mp_unpause_match", Hotkey = "F3" },
                new() { Name = "Restart Round", CommandScript = "mp_restartgame 1", Hotkey = "F4", Confirm = true, ConfirmMessage = "Restart current round?" },
                new() { Name = "Tech Timeout CT", CommandScript = "say [ADMIN] TECH TIMEOUT CT", Hotkey = "Ctrl+1" },
                new() { Name = "Tech Timeout T", CommandScript = "say [ADMIN] TECH TIMEOUT T", Hotkey = "Ctrl+2" },
                new() { Name = "Go Knife", CommandScript = "say [ADMIN] Knife round live in 10s;mp_restartgame 10", Hotkey = "Ctrl+K" },
                new() { Name = "End Match", CommandScript = "say [ADMIN] Match concluded", Hotkey = "Ctrl+E", Confirm = true, ConfirmMessage = "Mark end of match announcement?" },
            }
        };
    }
}
