using System.Diagnostics;
using System.Globalization;
using System.Management;
using System.Runtime.Versioning;
using System.Text.RegularExpressions;
using AssetMonitoringAgent.Models;
using Microsoft.Extensions.Logging;
using Microsoft.Win32;

namespace AssetMonitoringAgent.Services;

[SupportedOSPlatform("windows")]
public partial class HardwareCollectorService : IHardwareCollectorService
{
    private readonly ILogger<HardwareCollectorService> _logger;

    // Zero-Impact Performance: WMI Query Options with 5-second timeout and non-blocking return
    private static System.Management.EnumerationOptions DefaultWmiOptions => new()
    {
        Timeout = TimeSpan.FromSeconds(5),
        ReturnImmediately = true,
        Rewindable = false
    };

    [GeneratedRegex(@"(?:VID_|vid_)([0-9A-Fa-f]{4})", RegexOptions.IgnoreCase | RegexOptions.Compiled)]
    private static partial Regex VidRegex();

    [GeneratedRegex(@"(?:PID_|pid_)([0-9A-Fa-f]{4})", RegexOptions.IgnoreCase | RegexOptions.Compiled)]
    private static partial Regex PidRegex();

    public HardwareCollectorService(ILogger<HardwareCollectorService> logger)
    {
        _logger = logger;
    }

    #region Telemetry Collection

    public Task<TelemetryPayload> CollectTelemetryAsync()
    {
        string uuid = GetHardwareUuid();
        string hostname = Environment.MachineName;
        double cpuLoad = GetCpuLoadPercentage();
        var (totalRamGb, freeRamGb) = GetRamCapacityAndFreeGb();
        double usedRamPercent = totalRamGb > 0 ? Math.Round(((totalRamGb - freeRamGb) / totalRamGb) * 100.0, 2) : 0;
        var logicalDisks = GetLogicalDiskMetrics();
        var activeNetworks = GetActiveNetworkMetrics();
        var powerStatus = CollectPowerAndThermalMetrics();
        var topProcesses = GetTopResourceProcesses(5);
        bool pendingReboot = CheckPendingReboot();
        var (lastBootTime, uptimeDays) = GetSystemUptime();

        var payload = new TelemetryPayload(
            HardwareUuid: uuid,
            Hostname: hostname,
            TimestampUtc: DateTime.UtcNow,
            CpuLoadPercent: cpuLoad,
            RamTotalGb: totalRamGb,
            RamAvailableGb: freeRamGb,
            RamUsedPercent: usedRamPercent,
            Disks: logicalDisks,
            NetworkAdapters: activeNetworks,
            PowerStatus: powerStatus,
            TopProcesses: topProcesses,
            PendingReboot: pendingReboot,
            LastBootTime: lastBootTime?.ToUniversalTime().ToString("o"),
            UptimeDays: uptimeDays
        );

        return Task.FromResult(payload);
    }

    #endregion

    #region Full Inventory Collection

    public Task<FullInventoryPayload> CollectFullInventoryAsync()
    {
        var systemInfo = CollectSystemIdentity();
        var cpuInfo = CollectCpuInfo();
        var ramModules = CollectPhysicalRam();
        var logicalDisks = CollectLogicalDisks();
        var physicalDisks = CollectPhysicalDiskHealth();
        var networkAdapters = CollectNetworkAdapters();
        var monitors = CollectMonitors();
        var peripherals = CollectPeripherals();
        var software = CollectInstalledSoftware();
        var securityProducts = CollectSecurityProductStatus();
        var patches = CollectWindowsPatches();
        bool pendingReboot = CheckPendingReboot();
        var (lastBootTime, uptimeDays) = GetSystemUptime();

        string? latestKb = patches.FirstOrDefault()?.KbId;
        string? lastUpdateDate = patches.FirstOrDefault()?.InstalledOn;

        var enrichedSystem = systemInfo with
        {
            LatestKbId = latestKb,
            LastWindowsUpdate = lastUpdateDate,
            LastBootTime = lastBootTime?.ToUniversalTime().ToString("o")
        };

        var payload = new FullInventoryPayload(
            System: enrichedSystem,
            Cpu: cpuInfo,
            MemoryModules: ramModules,
            LogicalDisks: logicalDisks,
            PhysicalDisks: physicalDisks,
            NetworkAdapters: networkAdapters,
            Monitors: monitors,
            Peripherals: peripherals,
            InstalledSoftware: software,
            SecurityProducts: securityProducts,
            InstalledPatches: patches,
            PendingReboot: pendingReboot
        );

        return Task.FromResult(payload);
    }

    #endregion

    #region 1. System & OS Identifiers

    private SystemIdentityInfo CollectSystemIdentity()
    {
        string uuid = GetHardwareUuid();
        string biosSerial = string.Empty;
        string manufacturer = string.Empty;
        string model = string.Empty;
        string loggedInUser = string.Empty;
        string osName = string.Empty;
        string osVersion = string.Empty;
        string osBuild = string.Empty;

        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT SerialNumber FROM Win32_BIOS") { Options = DefaultWmiOptions };
            using var coll = searcher.Get();
            foreach (ManagementObject obj in coll.Cast<ManagementObject>())
            {
                using (obj)
                {
                    biosSerial = obj["SerialNumber"]?.ToString()?.Trim() ?? string.Empty;
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to query Win32_BIOS for serial number.");
        }

        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT Manufacturer, Model, UserName FROM Win32_ComputerSystem") { Options = DefaultWmiOptions };
            using var coll = searcher.Get();
            foreach (ManagementObject obj in coll.Cast<ManagementObject>())
            {
                using (obj)
                {
                    manufacturer = obj["Manufacturer"]?.ToString()?.Trim() ?? string.Empty;
                    model = obj["Model"]?.ToString()?.Trim() ?? string.Empty;
                    loggedInUser = obj["UserName"]?.ToString()?.Trim() ?? string.Empty;
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to query Win32_ComputerSystem.");
        }

        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT Caption, Version, BuildNumber FROM Win32_OperatingSystem") { Options = DefaultWmiOptions };
            using var coll = searcher.Get();
            foreach (ManagementObject obj in coll.Cast<ManagementObject>())
            {
                using (obj)
                {
                    osName = obj["Caption"]?.ToString()?.Trim() ?? string.Empty;
                    osVersion = obj["Version"]?.ToString()?.Trim() ?? string.Empty;
                    osBuild = obj["BuildNumber"]?.ToString()?.Trim() ?? string.Empty;
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to query Win32_OperatingSystem identity.");
        }

        int? osUbr = null;
        string displayVersion = string.Empty;

        try
        {
            using var cvKey = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows NT\CurrentVersion");
            if (cvKey != null)
            {
                displayVersion = cvKey.GetValue("DisplayVersion")?.ToString()?.Trim() ?? string.Empty;
                if (string.IsNullOrEmpty(displayVersion))
                {
                    displayVersion = cvKey.GetValue("ReleaseId")?.ToString()?.Trim() ?? string.Empty;
                }

                var ubrObj = cvKey.GetValue("UBR");
                if (ubrObj is int ubrVal)
                {
                    osUbr = ubrVal;
                }
                else if (ubrObj != null && int.TryParse(ubrObj.ToString(), out int parsedUbr))
                {
                    osUbr = parsedUbr;
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Failed to read Windows NT CurrentVersion registry values.");
        }

        string finalOsVersion = !string.IsNullOrEmpty(displayVersion) ? displayVersion : osVersion;
        string finalOsBuild = osBuild;
        if (osUbr.HasValue && !osBuild.Contains('.'))
        {
            finalOsBuild = $"{osBuild}.{osUbr.Value}";
        }

        return new SystemIdentityInfo(
            HardwareUuid: uuid,
            BiosSerialNumber: biosSerial,
            Manufacturer: manufacturer,
            Model: model,
            Hostname: Environment.MachineName,
            OsName: osName,
            OsVersion: finalOsVersion,
            OsBuild: finalOsBuild,
            CurrentLoggedInUser: loggedInUser,
            OsUbr: osUbr
        );
    }

    private string GetHardwareUuid()
    {
        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT UUID FROM Win32_ComputerSystemProduct") { Options = DefaultWmiOptions };
            using var coll = searcher.Get();
            foreach (ManagementObject obj in coll.Cast<ManagementObject>())
            {
                using (obj)
                {
                    var val = obj["UUID"]?.ToString()?.Trim();
                    if (!string.IsNullOrEmpty(val))
                        return val;
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to query Win32_ComputerSystemProduct for UUID.");
        }

        return "UNKNOWN-UUID";
    }

    #endregion

    #region 2. CPU, RAM, & Storage Health

    private CpuInfo CollectCpuInfo()
    {
        string model = string.Empty;
        uint cores = 0;
        uint logicalProcessors = 0;

        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT Name, NumberOfCores, NumberOfLogicalProcessors FROM Win32_Processor") { Options = DefaultWmiOptions };
            using var coll = searcher.Get();
            foreach (ManagementObject obj in coll.Cast<ManagementObject>())
            {
                using (obj)
                {
                    model = obj["Name"]?.ToString()?.Trim() ?? string.Empty;
                    cores = Convert.ToUInt32(obj["NumberOfCores"] ?? 0);
                    logicalProcessors = Convert.ToUInt32(obj["NumberOfLogicalProcessors"] ?? 0);
                    break;
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to query Win32_Processor.");
        }

        return new CpuInfo(model, cores, logicalProcessors);
    }

    private double GetCpuLoadPercentage()
    {
        try
        {
            using var searcher = new ManagementObjectSearcher(
                "SELECT PercentProcessorTime FROM Win32_PerfFormattedData_PerfOS_Processor WHERE Name='_Total'") { Options = DefaultWmiOptions };
            using var coll = searcher.Get();
            foreach (ManagementObject obj in coll.Cast<ManagementObject>())
            {
                using (obj)
                {
                    return Convert.ToDouble(obj["PercentProcessorTime"] ?? 0);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to query Win32_PerfFormattedData_PerfOS_Processor.");
        }

        return 0.0;
    }

    private (double TotalGb, double FreeGb) GetRamCapacityAndFreeGb()
    {
        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT TotalVisibleMemorySize, FreePhysicalMemory FROM Win32_OperatingSystem") { Options = DefaultWmiOptions };
            using var coll = searcher.Get();
            foreach (ManagementObject obj in coll.Cast<ManagementObject>())
            {
                using (obj)
                {
                    double totalKb = Convert.ToDouble(obj["TotalVisibleMemorySize"] ?? 0);
                    double freeKb = Convert.ToDouble(obj["FreePhysicalMemory"] ?? 0);

                    double totalGb = Math.Round(totalKb / 1024.0 / 1024.0, 2);
                    double freeGb = Math.Round(freeKb / 1024.0 / 1024.0, 2);
                    return (totalGb, freeGb);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to query Win32_OperatingSystem for RAM telemetry.");
        }

        return (0.0, 0.0);
    }

    private List<PhysicalMemoryInfo> CollectPhysicalRam()
    {
        var modules = new List<PhysicalMemoryInfo>();
        try
        {
            using var searcher = new ManagementObjectSearcher(
                "SELECT Manufacturer, PartNumber, SerialNumber, Capacity, Speed FROM Win32_PhysicalMemory") { Options = DefaultWmiOptions };
            using var coll = searcher.Get();
            foreach (ManagementObject obj in coll.Cast<ManagementObject>())
            {
                using (obj)
                {
                    ulong bytes = Convert.ToUInt64(obj["Capacity"] ?? 0);
                    double capacityGb = Math.Round(bytes / 1024.0 / 1024.0 / 1024.0, 2);
                    uint speed = Convert.ToUInt32(obj["Speed"] ?? 0);

                    modules.Add(new PhysicalMemoryInfo(
                        Manufacturer: obj["Manufacturer"]?.ToString()?.Trim() ?? "Unknown",
                        PartNumber: obj["PartNumber"]?.ToString()?.Trim() ?? "Unknown",
                        SerialNumber: obj["SerialNumber"]?.ToString()?.Trim() ?? "Unknown",
                        CapacityGb: capacityGb,
                        SpeedMhz: speed
                    ));
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to query Win32_PhysicalMemory.");
        }

        return modules;
    }

    private List<LogicalDiskInfo> CollectLogicalDisks()
    {
        var disks = new List<LogicalDiskInfo>();
        try
        {
            using var searcher = new ManagementObjectSearcher(
                "SELECT DeviceID, FileSystem, Size, FreeSpace FROM Win32_LogicalDisk WHERE DriveType=3") { Options = DefaultWmiOptions };
            using var coll = searcher.Get();
            foreach (ManagementObject obj in coll.Cast<ManagementObject>())
            {
                using (obj)
                {
                    ulong size = Convert.ToUInt64(obj["Size"] ?? 0);
                    ulong free = Convert.ToUInt64(obj["FreeSpace"] ?? 0);

                    disks.Add(new LogicalDiskInfo(
                        DriveLetter: obj["DeviceID"]?.ToString() ?? string.Empty,
                        FileSystem: obj["FileSystem"]?.ToString() ?? "Unknown",
                        TotalSizeGb: Math.Round(size / 1024.0 / 1024.0 / 1024.0, 2),
                        FreeSpaceGb: Math.Round(free / 1024.0 / 1024.0 / 1024.0, 2)
                    ));
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to query Win32_LogicalDisk for full inventory.");
        }

        return disks;
    }

    private List<LogicalDiskMetric> GetLogicalDiskMetrics()
    {
        var metrics = new List<LogicalDiskMetric>();
        try
        {
            using var searcher = new ManagementObjectSearcher(
                "SELECT DeviceID, Size, FreeSpace FROM Win32_LogicalDisk WHERE DriveType=3") { Options = DefaultWmiOptions };
            using var coll = searcher.Get();
            foreach (ManagementObject obj in coll.Cast<ManagementObject>())
            {
                using (obj)
                {
                    double sizeGb = Math.Round(Convert.ToUInt64(obj["Size"] ?? 0) / 1024.0 / 1024.0 / 1024.0, 2);
                    double freeGb = Math.Round(Convert.ToUInt64(obj["FreeSpace"] ?? 0) / 1024.0 / 1024.0 / 1024.0, 2);
                    double freePercent = sizeGb > 0 ? Math.Round((freeGb / sizeGb) * 100.0, 2) : 0;

                    metrics.Add(new LogicalDiskMetric(
                        DriveLetter: obj["DeviceID"]?.ToString() ?? string.Empty,
                        TotalSizeGb: sizeGb,
                        FreeSpaceGb: freeGb,
                        FreeSpacePercent: freePercent
                    ));
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to query Win32_LogicalDisk metrics.");
        }

        return metrics;
    }

    private List<PhysicalDiskHealthInfo> CollectPhysicalDiskHealth()
    {
        var disks = new List<PhysicalDiskHealthInfo>();
        try
        {
            var scope = new ManagementScope(@"root\Microsoft\Windows\Storage");
            scope.Connect();

            using var searcher = new ManagementObjectSearcher(
                scope,
                new ObjectQuery("SELECT FriendlyName, SerialNumber, MediaType, HealthStatus, OperationalStatus FROM MSFT_PhysicalDisk"))
            {
                Options = DefaultWmiOptions
            };
            using var coll = searcher.Get();

            foreach (ManagementObject obj in coll.Cast<ManagementObject>())
            {
                using (obj)
                {
                    string friendlyName = obj["FriendlyName"]?.ToString()?.Trim() ?? "Unknown";
                    string serialNumber = obj["SerialNumber"]?.ToString()?.Trim() ?? "Unknown";

                    ushort mediaTypeCode = Convert.ToUInt16(obj["MediaType"] ?? 0);
                    string mediaType = mediaTypeCode switch
                    {
                        3 => "HDD",
                        4 => "SSD",
                        5 => "SCM",
                        _ => "Unspecified"
                    };

                    ushort healthCode = Convert.ToUInt16(obj["HealthStatus"] ?? 0);
                    string healthStatus = healthCode switch
                    {
                        0 => "Healthy",
                        1 => "Warning",
                        2 => "Unhealthy",
                        _ => "Unknown"
                    };

                    string operationalStatus = "Unknown";
                    if (obj["OperationalStatus"] is ushort[] opCodes && opCodes.Length > 0)
                    {
                        operationalStatus = opCodes[0] switch
                        {
                            1 => "Other",
                            2 => "OK",
                            3 => "Degraded",
                            4 => "Stressed",
                            5 => "Predictive Failure",
                            6 => "Error",
                            7 => "Non-Recoverable Error",
                            8 => "Starting",
                            9 => "Stopping",
                            10 => "Stopped",
                            11 => "In Service",
                            _ => $"Status_{opCodes[0]}"
                        };
                    }

                    disks.Add(new PhysicalDiskHealthInfo(
                        FriendlyName: friendlyName,
                        SerialNumber: serialNumber,
                        MediaType: mediaType,
                        HealthStatus: healthStatus,
                        OperationalStatus: operationalStatus
                    ));
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to query root\\Microsoft\\Windows\\Storage:MSFT_PhysicalDisk.");
        }

        return disks;
    }

    #endregion

    #region 3. Network Adapters & Link Speed

    private List<NetworkAdapterDetailInfo> CollectNetworkAdapters()
    {
        var adapters = new List<NetworkAdapterDetailInfo>();
        try
        {
            var speedMap = new Dictionary<uint, double>();
            using (var adapterSearcher = new ManagementObjectSearcher("SELECT Index, Speed FROM Win32_NetworkAdapter") { Options = DefaultWmiOptions })
            using (var adapterColl = adapterSearcher.Get())
            {
                foreach (ManagementObject adapter in adapterColl.Cast<ManagementObject>())
                {
                    using (adapter)
                    {
                        if (adapter["Index"] is uint idx && adapter["Speed"] != null)
                        {
                            ulong speedBps = Convert.ToUInt64(adapter["Speed"]);
                            speedMap[idx] = Math.Round(speedBps / 1_000_000.0, 2);
                        }
                    }
                }
            }

            using var configSearcher = new ManagementObjectSearcher(
                "SELECT Index, Description, MACAddress, IPAddress, DefaultIPGateway FROM Win32_NetworkAdapterConfiguration WHERE IPEnabled = True")
            {
                Options = DefaultWmiOptions
            };
            using var configColl = configSearcher.Get();

            foreach (ManagementObject config in configColl.Cast<ManagementObject>())
            {
                using (config)
                {
                    uint idx = Convert.ToUInt32(config["Index"] ?? 0);
                    string desc = config["Description"]?.ToString() ?? "Unknown";
                    string mac = config["MACAddress"]?.ToString() ?? "Unknown";

                    string? ipv4 = null;
                    if (config["IPAddress"] is string[] ips)
                    {
                        ipv4 = ips.FirstOrDefault(ip => ip.Contains('.') && !ip.StartsWith("127."));
                    }

                    string? gateway = null;
                    if (config["DefaultIPGateway"] is string[] gateways)
                    {
                        gateway = gateways.FirstOrDefault();
                    }

                    double speedMbps = speedMap.TryGetValue(idx, out var spd) ? spd : 0.0;

                    adapters.Add(new NetworkAdapterDetailInfo(
                        Description: desc,
                        MacAddress: mac,
                        Ipv4Address: ipv4,
                        DefaultGateway: gateway,
                        LinkSpeedMbps: speedMbps
                    ));
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to query network adapter inventory.");
        }

        return adapters;
    }

    private List<NetworkStatusMetric> GetActiveNetworkMetrics()
    {
        var metrics = new List<NetworkStatusMetric>();
        try
        {
            var speedMap = new Dictionary<uint, double>();
            using (var searcher = new ManagementObjectSearcher("SELECT Index, Speed, NetConnectionStatus FROM Win32_NetworkAdapter") { Options = DefaultWmiOptions })
            using (var coll = searcher.Get())
            {
                foreach (ManagementObject adapter in coll.Cast<ManagementObject>())
                {
                    using (adapter)
                    {
                        if (adapter["Index"] is uint idx)
                        {
                            ulong bps = adapter["Speed"] != null ? Convert.ToUInt64(adapter["Speed"]) : 0;
                            speedMap[idx] = Math.Round(bps / 1_000_000.0, 2);
                        }
                    }
                }
            }

            using var configSearcher = new ManagementObjectSearcher(
                "SELECT Index, Description, MACAddress, IPAddress FROM Win32_NetworkAdapterConfiguration WHERE IPEnabled = True")
            {
                Options = DefaultWmiOptions
            };
            using var configColl = configSearcher.Get();

            foreach (ManagementObject config in configColl.Cast<ManagementObject>())
            {
                using (config)
                {
                    uint idx = Convert.ToUInt32(config["Index"] ?? 0);
                    string desc = config["Description"]?.ToString() ?? "Unknown";
                    string mac = config["MACAddress"]?.ToString() ?? "Unknown";

                    string? ipv4 = null;
                    if (config["IPAddress"] is string[] ips)
                    {
                        ipv4 = ips.FirstOrDefault(ip => ip.Contains('.') && !ip.StartsWith("127."));
                    }

                    double speed = speedMap.TryGetValue(idx, out var s) ? s : 0;

                    metrics.Add(new NetworkStatusMetric(
                        Description: desc,
                        MacAddress: mac,
                        Ipv4Address: ipv4,
                        LinkSpeedMbps: speed,
                        IsConnected: !string.IsNullOrEmpty(ipv4)
                    ));
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to query active network metrics.");
        }

        return metrics;
    }

    #endregion

    #region 4. Monitors (EDID Data via root\wmi)

    private List<MonitorEdidInfo> CollectMonitors()
    {
        var monitors = new List<MonitorEdidInfo>();
        try
        {
            var scope = new ManagementScope(@"root\wmi");
            scope.Connect();

            using var searcher = new ManagementObjectSearcher(
                scope,
                new ObjectQuery("SELECT ManufacturerName, UserFriendlyName, SerialNumberID FROM WmiMonitorID WHERE Active = True"))
            {
                Options = DefaultWmiOptions
            };
            using var coll = searcher.Get();

            foreach (ManagementObject obj in coll.Cast<ManagementObject>())
            {
                using (obj)
                {
                    string mfg = DecodeWmiEdidString(obj["ManufacturerName"]);
                    string name = DecodeWmiEdidString(obj["UserFriendlyName"]);
                    string serial = DecodeWmiEdidString(obj["SerialNumberID"]);

                    monitors.Add(new MonitorEdidInfo(
                        Manufacturer: string.IsNullOrWhiteSpace(mfg) ? "Generic" : mfg,
                        Model: string.IsNullOrWhiteSpace(name) ? "Display" : name,
                        SerialNumber: string.IsNullOrWhiteSpace(serial) ? "None" : serial
                    ));
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to query root\\wmi:WmiMonitorID.");
        }

        return monitors;
    }

    private static string DecodeWmiEdidString(object? rawValue)
    {
        if (rawValue is null) return string.Empty;

        if (rawValue is ushort[] ushorts)
        {
            var chars = ushorts.TakeWhile(c => c != 0).Select(c => (char)c).ToArray();
            return new string(chars).Trim();
        }

        if (rawValue is byte[] bytes)
        {
            var chars = bytes.TakeWhile(c => c != 0).Select(c => (char)c).ToArray();
            return new string(chars).Trim();
        }

        if (rawValue is Array arr)
        {
            var list = new List<char>();
            foreach (var item in arr)
            {
                if (item is IConvertible convertible)
                {
                    int code = convertible.ToInt32(CultureInfo.InvariantCulture);
                    if (code == 0) break;
                    list.Add((char)code);
                }
            }
            return new string(list.ToArray()).Trim();
        }

        return string.Empty;
    }

    #endregion

    #region 5. Peripherals (Mouse & Keyboard)

    private List<PeripheralDeviceInfo> CollectPeripherals()
    {
        var peripherals = new List<PeripheralDeviceInfo>();

        // Pointing devices (Mice, Touchpads)
        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT Name, Description, PNPDeviceID FROM Win32_PointingDevice") { Options = DefaultWmiOptions };
            using var coll = searcher.Get();
            foreach (ManagementObject obj in coll.Cast<ManagementObject>())
            {
                using (obj)
                {
                    string pnpId = obj["PNPDeviceID"]?.ToString() ?? string.Empty;
                    ExtractVidPid(pnpId, out string? vid, out string? pid);

                    peripherals.Add(new PeripheralDeviceInfo(
                        DeviceType: "Mouse",
                        Name: obj["Name"]?.ToString() ?? "Unknown Mouse",
                        Description: obj["Description"]?.ToString() ?? string.Empty,
                        PnpDeviceId: pnpId,
                        VendorId: vid,
                        ProductId: pid
                    ));
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to query Win32_PointingDevice.");
        }

        // Keyboards
        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT Name, Description, PNPDeviceID FROM Win32_Keyboard") { Options = DefaultWmiOptions };
            using var coll = searcher.Get();
            foreach (ManagementObject obj in coll.Cast<ManagementObject>())
            {
                using (obj)
                {
                    string pnpId = obj["PNPDeviceID"]?.ToString() ?? string.Empty;
                    ExtractVidPid(pnpId, out string? vid, out string? pid);

                    peripherals.Add(new PeripheralDeviceInfo(
                        DeviceType: "Keyboard",
                        Name: obj["Name"]?.ToString() ?? "Unknown Keyboard",
                        Description: obj["Description"]?.ToString() ?? string.Empty,
                        PnpDeviceId: pnpId,
                        VendorId: vid,
                        ProductId: pid
                    ));
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to query Win32_Keyboard.");
        }

        return peripherals;
    }

    private static void ExtractVidPid(string pnpDeviceId, out string? vid, out string? pid)
    {
        vid = null;
        pid = null;

        if (string.IsNullOrWhiteSpace(pnpDeviceId)) return;

        var vidMatch = VidRegex().Match(pnpDeviceId);
        if (vidMatch.Success)
            vid = vidMatch.Groups[1].Value.ToUpperInvariant();

        var pidMatch = PidRegex().Match(pnpDeviceId);
        if (pidMatch.Success)
            pid = pidMatch.Groups[1].Value.ToUpperInvariant();
    }

    #endregion

    #region 6. Installed Software (Registry Inspection ONLY - Strict Privacy Compliant)

    private List<InstalledSoftwareInfo> CollectInstalledSoftware()
    {
        var softwareList = new List<InstalledSoftwareInfo>();
        var seenKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        // Read 64-bit Registry
        ReadUninstallRegistry(RegistryView.Registry64, softwareList, seenKeys);
        // Read 32-bit Registry (WoW6432Node)
        ReadUninstallRegistry(RegistryView.Registry32, softwareList, seenKeys);

        return softwareList.OrderBy(s => s.DisplayName).ToList();
    }

    private void ReadUninstallRegistry(RegistryView view, List<InstalledSoftwareInfo> results, HashSet<string> seen)
    {
        const string uninstallKeyPath = @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall";

        try
        {
            using var baseKey = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, view);
            using var subKey = baseKey.OpenSubKey(uninstallKeyPath);
            if (subKey is null) return;

            foreach (var subKeyName in subKey.GetSubKeyNames())
            {
                try
                {
                    using var appKey = subKey.OpenSubKey(subKeyName);
                    if (appKey is null) continue;

                    // Filter out internal system components and patch bundles
                    var isSystemComponent = appKey.GetValue("SystemComponent");
                    if (isSystemComponent is int sysComp && sysComp == 1)
                        continue;

                    var parentKeyName = appKey.GetValue("ParentKeyName")?.ToString();
                    if (!string.IsNullOrEmpty(parentKeyName))
                        continue;

                    string? name = appKey.GetValue("DisplayName")?.ToString()?.Trim();
                    if (string.IsNullOrWhiteSpace(name))
                        continue;

                    // Filter out Windows Hotfixes / Security patches directly
                    if (name.StartsWith("Security Update for", StringComparison.OrdinalIgnoreCase) ||
                        name.StartsWith("Update for", StringComparison.OrdinalIgnoreCase) ||
                        subKeyName.StartsWith("KB", StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }

                    string version = appKey.GetValue("DisplayVersion")?.ToString()?.Trim() ?? string.Empty;
                    string publisher = appKey.GetValue("Publisher")?.ToString()?.Trim() ?? string.Empty;
                    string rawDate = appKey.GetValue("InstallDate")?.ToString()?.Trim() ?? string.Empty;

                    // Format YYYYMMDD to YYYY-MM-DD when possible
                    string formattedDate = rawDate;
                    if (rawDate.Length == 8 && DateTime.TryParseExact(rawDate, "yyyyMMdd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsedDate))
                    {
                        formattedDate = parsedDate.ToString("yyyy-MM-dd");
                    }

                    string compositeKey = $"{name}::{version}";
                    if (seen.Add(compositeKey))
                    {
                        results.Add(new InstalledSoftwareInfo(
                            DisplayName: name,
                            DisplayVersion: version,
                            Publisher: publisher,
                            InstallDate: formattedDate
                        ));
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogDebug(ex, "Failed to read application subkey {SubKeyName}", subKeyName);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to open registry uninstall key for {View}.", view);
        }
    }

    #endregion

    #region 7. Security & Antivirus Endpoint Status

    public List<SecurityEndpointStatus> CollectSecurityProductStatus()
    {
        var list = new List<SecurityEndpointStatus>();

        try
        {
            // root\SecurityCenter2 is available on Windows Workstations (Windows 10/11)
            var scope = new ManagementScope(@"root\SecurityCenter2");
            scope.Connect();

            using var searcher = new ManagementObjectSearcher(
                scope,
                new ObjectQuery("SELECT displayName, productState FROM AntivirusProduct"))
            {
                Options = DefaultWmiOptions
            };
            using var coll = searcher.Get();

            foreach (ManagementObject obj in coll.Cast<ManagementObject>())
            {
                using (obj)
                {
                    string name = obj["displayName"]?.ToString() ?? "Unknown Security Product";
                    uint state = Convert.ToUInt32(obj["productState"] ?? 0);
                    string stateHex = $"0x{state:X6}";

                    bool isRealTimeOn = ((state & 0x00FF00) >> 8) == 0x10;
                    bool isDefsUpToDate = (state & 0x0000FF) == 0x00;

                    list.Add(new SecurityEndpointStatus(
                        AntivirusProductName: name,
                        IsRealTimeProtectionEnabled: isRealTimeOn,
                        AreSignaturesUpToDate: isDefsUpToDate,
                        StateHex: stateHex
                    ));
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Failed to query root\\SecurityCenter2:AntivirusProduct (Expected on Windows Server).");
        }

        return list;
    }

    #endregion

    #region 8. Battery, Power & Thermal Telemetry

    public PowerStatusMetric CollectPowerAndThermalMetrics()
    {
        bool isAcConnected = true;
        int? batteryPercent = null;
        string batteryStatus = "No Battery / Desktop AC";
        double? cpuTemp = null;

        // 1. Battery Query
        try
        {
            using var searcher = new ManagementObjectSearcher(
                "SELECT BatteryStatus, EstimatedChargeRemaining FROM Win32_Battery") { Options = DefaultWmiOptions };
            using var coll = searcher.Get();

            foreach (ManagementObject obj in coll.Cast<ManagementObject>())
            {
                using (obj)
                {
                    batteryPercent = Convert.ToInt32(obj["EstimatedChargeRemaining"] ?? 100);
                    ushort statusCode = Convert.ToUInt16(obj["BatteryStatus"] ?? 2);

                    batteryStatus = statusCode switch
                    {
                        1 => "Discharging",
                        2 => "AC Connected / Charging",
                        3 => "Fully Charged",
                        4 => "Low",
                        5 => "Critical",
                        6 => "Charging",
                        7 => "Charging and High",
                        8 => "Charging and Low",
                        9 => "Charging and Critical",
                        _ => "Unknown"
                    };

                    isAcConnected = statusCode != 1;
                    break;
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "No Win32_Battery found (Desktop workstation).");
        }

        // 2. ACPI Thermal Zone Query
        try
        {
            var scope = new ManagementScope(@"root\wmi");
            scope.Connect();

            using var searcher = new ManagementObjectSearcher(
                scope,
                new ObjectQuery("SELECT CurrentTemperature FROM MSAcpi_ThermalZoneTemperature"))
            {
                Options = DefaultWmiOptions
            };
            using var coll = searcher.Get();

            foreach (ManagementObject obj in coll.Cast<ManagementObject>())
            {
                using (obj)
                {
                    double kelvinTenths = Convert.ToDouble(obj["CurrentTemperature"] ?? 0);
                    if (kelvinTenths > 0)
                    {
                        cpuTemp = Math.Round((kelvinTenths / 10.0) - 273.15, 1);
                        break;
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "MSAcpi_ThermalZoneTemperature not supported by motherboard ACPI BIOS.");
        }

        return new PowerStatusMetric(isAcConnected, batteryPercent, batteryStatus, cpuTemp);
    }

    #endregion

    #region 9. Top Resource Consuming Processes (Zero-Impact In-Memory Snapshot)

    public List<ProcessResourceMetric> GetTopResourceProcesses(int count = 5)
    {
        var processList = new List<ProcessResourceMetric>();

        try
        {
            var processes = Process.GetProcesses();

            var topProcesses = processes
                .Where(p => {
                    try { return !p.HasExited && p.Id != 0; }
                    catch { return false; }
                })
                .Select(p => {
                    try
                    {
                        double workingSetMb = Math.Round(p.WorkingSet64 / 1024.0 / 1024.0, 2);
                        double cpuTime = p.TotalProcessorTime.TotalSeconds;
                        return new ProcessResourceMetric(p.Id, p.ProcessName, workingSetMb, cpuTime);
                    }
                    catch
                    {
                        // Ignore permission denials on system kernel processes
                        return null;
                    }
                })
                .Where(p => p is not null)
                .OrderByDescending(p => p!.MemoryWorkingSetMb)
                .Take(count)
                .ToList();

            foreach (var p in processes)
            {
                p.Dispose();
            }

            return topProcesses!;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to collect process resource metrics.");
            return processList;
        }
    }

    #endregion

    #region Windows Patch Management & Pending Reboot Detection

    /// <summary>
    /// Collects installed Windows Security & Cumulative Updates via WMI Win32_QuickFixEngineering.
    /// </summary>
    public List<WindowsPatchInfo> CollectWindowsPatches()
    {
        var list = new List<WindowsPatchInfo>();
        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT HotFixID, Description, InstalledOn FROM Win32_QuickFixEngineering")
            {
                Options = DefaultWmiOptions
            };
            using var coll = searcher.Get();
            foreach (ManagementObject obj in coll.Cast<ManagementObject>())
            {
                using (obj)
                {
                    string hotFixId = obj["HotFixID"]?.ToString()?.Trim() ?? string.Empty;
                    if (string.IsNullOrEmpty(hotFixId) || hotFixId.Equals("File 1", StringComparison.OrdinalIgnoreCase))
                        continue;

                    string desc = obj["Description"]?.ToString()?.Trim() ?? "Update";
                    string installedOnRaw = obj["InstalledOn"]?.ToString()?.Trim() ?? string.Empty;

                    string formattedDate = string.Empty;
                    if (!string.IsNullOrEmpty(installedOnRaw))
                    {
                        if (DateTime.TryParse(installedOnRaw, CultureInfo.InvariantCulture, DateTimeStyles.None, out var dt) ||
                            DateTime.TryParse(installedOnRaw, CultureInfo.CurrentCulture, DateTimeStyles.None, out dt))
                        {
                            formattedDate = dt.ToString("yyyy-MM-dd");
                        }
                        else
                        {
                            formattedDate = installedOnRaw;
                        }
                    }

                    string normalizedKb = hotFixId.StartsWith("KB", StringComparison.OrdinalIgnoreCase) 
                        ? hotFixId.ToUpperInvariant() 
                        : $"KB{hotFixId}";

                    list.Add(new WindowsPatchInfo(
                        KbId: normalizedKb,
                        Description: desc,
                        InstalledOn: formattedDate
                    ));
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to query Win32_QuickFixEngineering for Windows patches.");
        }

        return list.OrderByDescending(p => p.InstalledOn).ToList();
    }

    /// <summary>
    /// Checks standard Windows Registry locations for pending reboot flags (CBS, WindowsUpdate, Session Manager).
    /// </summary>
    public bool CheckPendingReboot()
    {
        try
        {
            // 1. Component-Based Servicing (CBS) Reboot Pending
            using var cbsKey = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending");
            if (cbsKey != null) return true;

            // 2. Windows Update Auto-Update Reboot Required
            using var wuKey = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired");
            if (wuKey != null) return true;

            // 3. Pending File Rename Operations (Session Manager)
            using var smKey = Registry.LocalMachine.OpenSubKey(@"SYSTEM\CurrentControlSet\Control\Session Manager");
            if (smKey != null)
            {
                var val = smKey.GetValue("PendingFileRenameOperations");
                if (val is string[] strArr && strArr.Length > 0)
                {
                    if (strArr.Any(s => !string.IsNullOrWhiteSpace(s)))
                        return true;
                }
                else if (val is string s && !string.IsNullOrWhiteSpace(s))
                {
                    return true;
                }
            }

            // 4. System Center / Intune Client Reboot Pending
            using var ccmKey = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\SMS\Mobile Client\Reboot Management\RebootData");
            if (ccmKey != null) return true;
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Could not evaluate pending reboot registry status.");
        }

        return false;
    }

    /// <summary>
    /// Queries Win32_OperatingSystem.LastBootUpTime to compute exact uptime and boot timestamp.
    /// </summary>
    public (DateTime? LastBootTime, double UptimeDays) GetSystemUptime()
    {
        DateTime? lastBoot = null;
        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT LastBootUpTime FROM Win32_OperatingSystem")
            {
                Options = DefaultWmiOptions
            };
            using var coll = searcher.Get();
            foreach (ManagementObject obj in coll.Cast<ManagementObject>())
            {
                using (obj)
                {
                    string raw = obj["LastBootUpTime"]?.ToString() ?? string.Empty;
                    if (!string.IsNullOrEmpty(raw))
                    {
                        lastBoot = ManagementDateTimeConverter.ToDateTime(raw);
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Failed to query Win32_OperatingSystem.LastBootUpTime, using Environment.TickCount64 fallback.");
        }

        if (!lastBoot.HasValue)
        {
            var uptimeSpan = TimeSpan.FromMilliseconds(Environment.TickCount64);
            lastBoot = DateTime.UtcNow - uptimeSpan;
        }

        double days = lastBoot.HasValue 
            ? Math.Round((DateTime.UtcNow - lastBoot.Value.ToUniversalTime()).TotalDays, 2) 
            : 0;

        return (lastBoot, days);
    }

    #endregion
}
