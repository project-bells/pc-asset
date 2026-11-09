namespace AssetMonitoringAgent.Services;

public interface IUpdateService
{
    Task<bool> CheckAndApplyUpdateAsync(CancellationToken stoppingToken);
}

