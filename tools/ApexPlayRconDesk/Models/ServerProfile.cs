namespace ApexPlayRconDesk.Models;

public sealed class ServerProfile
{
    public string Name { get; set; } = "CS2 Server";
    public string Host { get; set; } = "127.0.0.1";
    public int Port { get; set; } = 27015;
    public string RconPassword { get; set; } = "";
    public string ServerPassword { get; set; } = "";
    public override string ToString() => $"{Name} ({Host}:{Port})";
}
