namespace ApexPlayRconDesk.Models;

public sealed class AppSettings
{
    public List<ServerProfile> Servers { get; set; } = new();
    public string? LastServerName { get; set; }
    public List<ActionPreset> Actions { get; set; } = new();
}
