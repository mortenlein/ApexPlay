using CounterStrikeSharp.API.Core;

namespace ApexPlayTelemetry;

public sealed class ApexPlayTelemetryConfig : IBasePluginConfig
{
    public int Version { get; set; } = 1;
    public string WebhookUrl { get; set; } = "https://your-domain.com/api/webhooks/cs2";
    public string WebhookKey { get; set; } = "replace-with-cs2-webhook-key";
    public int HttpTimeoutMs { get; set; } = 3000;
    public int MaxQueueSize { get; set; } = 500;
    public int MaxRetryAttempts { get; set; } = 6;
    public int RetryBaseDelayMs { get; set; } = 500;
    public int RetryMaxDelayMs { get; set; } = 10000;
    public bool EnableHeartbeat { get; set; } = true;
    public int HeartbeatIntervalSeconds { get; set; } = 20;
    public bool EnablePlayerSnapshots { get; set; } = true;
    public int PlayerSnapshotIntervalSeconds { get; set; } = 2;
}
