using System.Runtime.Versioning;
using AssetMonitoringAgent.Models;

namespace AssetMonitoringAgent.Services;

[SupportedOSPlatform("windows")]
public interface IHardwareCollectorService
{
    Task<TelemetryPayload> CollectTelemetryAsync();
    Task<FullInventoryPayload> CollectFullInventoryAsync();
    List<ProcessResourceMetric> GetTopResourceProcesses(int count = 5);
    PowerStatusMetric CollectPowerAndThermalMetrics();
    List<SecurityEndpointStatus> CollectSecurityProductStatus();
}

