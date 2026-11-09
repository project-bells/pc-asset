using System.Text.Json.Serialization;

namespace AssetMonitoringAgent.Models;

public record TelemetryServerResponse(
    [property: JsonPropertyName("status")] string Status,
    [property: JsonPropertyName("pendingCommands")] List<AgentCommandDirective>? PendingCommands
);

public record AgentCommandDirective(
    [property: JsonPropertyName("commandId")] string CommandId,
    [property: JsonPropertyName("action")] string Action,
    [property: JsonPropertyName("parameters")] Dictionary<string, string>? Parameters
);

public record CommandExecutionResult(
    [property: JsonPropertyName("commandId")] string CommandId,
    [property: JsonPropertyName("status")] string Status,
    [property: JsonPropertyName("output")] string Output,
    [property: JsonPropertyName("executedAtUtc")] DateTime ExecutedAtUtc
);

public record AgentVersionResponse(
    [property: JsonPropertyName("latestVersion")] string LatestVersion,
    [property: JsonPropertyName("downloadUrl")] string DownloadUrl,
    [property: JsonPropertyName("sha256")] string Sha256
);
