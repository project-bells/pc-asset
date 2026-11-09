namespace AssetMonitoringAgent.Services;

public interface IOfflineSpoolingService
{
    Task EnqueueAsync(string endpoint, byte[] payload);
    Task DrainQueueAsync(Func<string, byte[], Task<bool>> sendFunc, CancellationToken ct);
}

