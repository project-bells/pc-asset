using System.Text.Json.Serialization;

namespace AssetMonitoringAgent.Models;

#region Telemetry Models

public record TelemetryPayload(
    [property: JsonPropertyName("hardwareUuid")] string HardwareUuid,
    [property: JsonPropertyName("hostname")] string Hostname,
    [property: JsonPropertyName("timestampUtc")] DateTime TimestampUtc,
    [property: JsonPropertyName("cpuLoadPercent")] double CpuLoadPercent,
    [property: JsonPropertyName("ramTotalGb")] double RamTotalGb,
    [property: JsonPropertyName("ramAvailableGb")] double RamAvailableGb,
    [property: JsonPropertyName("ramUsedPercent")] double RamUsedPercent,
    [property: JsonPropertyName("disks")] List<LogicalDiskMetric> Disks,
    [property: JsonPropertyName("networkAdapters")] List<NetworkStatusMetric> NetworkAdapters,
    [property: JsonPropertyName("powerStatus")] PowerStatusMetric? PowerStatus,
    [property: JsonPropertyName("topProcesses")] List<ProcessResourceMetric> TopProcesses,
    [property: JsonPropertyName("pendingReboot")] bool PendingReboot = false,
    [property: JsonPropertyName("lastBootTime")] string? LastBootTime = null,
    [property: JsonPropertyName("uptimeDays")] double UptimeDays = 0
);

public record LogicalDiskMetric(
    [property: JsonPropertyName("driveLetter")] string DriveLetter,
    [property: JsonPropertyName("totalSizeGb")] double TotalSizeGb,
    [property: JsonPropertyName("freeSpaceGb")] double FreeSpaceGb,
    [property: JsonPropertyName("freeSpacePercent")] double FreeSpacePercent
);

public record NetworkStatusMetric(
    [property: JsonPropertyName("description")] string Description,
    [property: JsonPropertyName("macAddress")] string MacAddress,
    [property: JsonPropertyName("ipv4Address")] string? Ipv4Address,
    [property: JsonPropertyName("linkSpeedMbps")] double LinkSpeedMbps,
    [property: JsonPropertyName("isConnected")] bool IsConnected
);

public record PowerStatusMetric(
    [property: JsonPropertyName("isAcLineConnected")] bool IsAcLineConnected,
    [property: JsonPropertyName("batteryChargePercent")] int? BatteryChargePercent,
    [property: JsonPropertyName("batteryStatusDescription")] string BatteryStatusDescription,
    [property: JsonPropertyName("cpuTemperatureCelsius")] double? CpuTemperatureCelsius
);

public record ProcessResourceMetric(
    [property: JsonPropertyName("processId")] int ProcessId,
    [property: JsonPropertyName("processName")] string ProcessName,
    [property: JsonPropertyName("memoryWorkingSetMb")] double MemoryWorkingSetMb,
    [property: JsonPropertyName("totalProcessorTimeSec")] double TotalProcessorTimeSec
);

#endregion

#region Full Inventory Models

public record FullInventoryPayload(
    [property: JsonPropertyName("system")] SystemIdentityInfo System,
    [property: JsonPropertyName("cpu")] CpuInfo Cpu,
    [property: JsonPropertyName("memoryModules")] List<PhysicalMemoryInfo> MemoryModules,
    [property: JsonPropertyName("logicalDisks")] List<LogicalDiskInfo> LogicalDisks,
    [property: JsonPropertyName("physicalDisks")] List<PhysicalDiskHealthInfo> PhysicalDisks,
    [property: JsonPropertyName("networkAdapters")] List<NetworkAdapterDetailInfo> NetworkAdapters,
    [property: JsonPropertyName("monitors")] List<MonitorEdidInfo> Monitors,
    [property: JsonPropertyName("peripherals")] List<PeripheralDeviceInfo> Peripherals,
    [property: JsonPropertyName("installedSoftware")] List<InstalledSoftwareInfo> InstalledSoftware,
    [property: JsonPropertyName("securityProducts")] List<SecurityEndpointStatus> SecurityProducts,
    [property: JsonPropertyName("installedPatches")] List<WindowsPatchInfo>? InstalledPatches = null,
    [property: JsonPropertyName("pendingReboot")] bool PendingReboot = false
);

public record WindowsPatchInfo(
    [property: JsonPropertyName("kbId")] string KbId,
    [property: JsonPropertyName("description")] string Description,
    [property: JsonPropertyName("installedOn")] string InstalledOn
);

public record SystemIdentityInfo(
    [property: JsonPropertyName("hardwareUuid")] string HardwareUuid,
    [property: JsonPropertyName("biosSerialNumber")] string BiosSerialNumber,
    [property: JsonPropertyName("manufacturer")] string Manufacturer,
    [property: JsonPropertyName("model")] string Model,
    [property: JsonPropertyName("hostname")] string Hostname,
    [property: JsonPropertyName("osName")] string OsName,
    [property: JsonPropertyName("osVersion")] string OsVersion,
    [property: JsonPropertyName("osBuild")] string OsBuild,
    [property: JsonPropertyName("currentLoggedInUser")] string CurrentLoggedInUser,
    [property: JsonPropertyName("osUbr")] int? OsUbr = null,
    [property: JsonPropertyName("latestKbId")] string? LatestKbId = null,
    [property: JsonPropertyName("lastWindowsUpdate")] string? LastWindowsUpdate = null,
    [property: JsonPropertyName("lastBootTime")] string? LastBootTime = null
);

public record CpuInfo(
    [property: JsonPropertyName("model")] string Model,
    [property: JsonPropertyName("physicalCores")] uint PhysicalCores,
    [property: JsonPropertyName("logicalProcessors")] uint LogicalProcessors
);

public record PhysicalMemoryInfo(
    [property: JsonPropertyName("manufacturer")] string Manufacturer,
    [property: JsonPropertyName("partNumber")] string PartNumber,
    [property: JsonPropertyName("serialNumber")] string SerialNumber,
    [property: JsonPropertyName("capacityGb")] double CapacityGb,
    [property: JsonPropertyName("speedMhz")] uint SpeedMhz
);

public record LogicalDiskInfo(
    [property: JsonPropertyName("driveLetter")] string DriveLetter,
    [property: JsonPropertyName("fileSystem")] string FileSystem,
    [property: JsonPropertyName("totalSizeGb")] double TotalSizeGb,
    [property: JsonPropertyName("freeSpaceGb")] double FreeSpaceGb
);

public record PhysicalDiskHealthInfo(
    [property: JsonPropertyName("friendlyName")] string FriendlyName,
    [property: JsonPropertyName("serialNumber")] string SerialNumber,
    [property: JsonPropertyName("mediaType")] string MediaType,
    [property: JsonPropertyName("healthStatus")] string HealthStatus,
    [property: JsonPropertyName("operationalStatus")] string OperationalStatus
);

public record NetworkAdapterDetailInfo(
    [property: JsonPropertyName("description")] string Description,
    [property: JsonPropertyName("macAddress")] string MacAddress,
    [property: JsonPropertyName("ipv4Address")] string? Ipv4Address,
    [property: JsonPropertyName("defaultGateway")] string? DefaultGateway,
    [property: JsonPropertyName("linkSpeedMbps")] double LinkSpeedMbps
);

public record MonitorEdidInfo(
    [property: JsonPropertyName("manufacturer")] string Manufacturer,
    [property: JsonPropertyName("model")] string Model,
    [property: JsonPropertyName("serialNumber")] string SerialNumber
);

public record PeripheralDeviceInfo(
    [property: JsonPropertyName("type")] string DeviceType,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("description")] string Description,
    [property: JsonPropertyName("pnpDeviceId")] string PnpDeviceId,
    [property: JsonPropertyName("vendorId")] string? VendorId,
    [property: JsonPropertyName("productId")] string? ProductId
);

public record InstalledSoftwareInfo(
    [property: JsonPropertyName("displayName")] string DisplayName,
    [property: JsonPropertyName("displayVersion")] string DisplayVersion,
    [property: JsonPropertyName("publisher")] string Publisher,
    [property: JsonPropertyName("installDate")] string InstallDate
);

public record SecurityEndpointStatus(
    [property: JsonPropertyName("antivirusProductName")] string AntivirusProductName,
    [property: JsonPropertyName("isRealTimeProtectionEnabled")] bool IsRealTimeProtectionEnabled,
    [property: JsonPropertyName("areSignaturesUpToDate")] bool AreSignaturesUpToDate,
    [property: JsonPropertyName("stateHex")] string StateHex
);

#endregion

