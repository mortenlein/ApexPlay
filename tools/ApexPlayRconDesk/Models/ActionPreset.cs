namespace ApexPlayRconDesk.Models;

public sealed class ActionPreset
{
    public string Name { get; set; } = "Action";
    public string CommandScript { get; set; } = "";
    public string Hotkey { get; set; } = "";
    public bool Confirm { get; set; } = false;
    public string ConfirmMessage { get; set; } = "Run this command?";
}
