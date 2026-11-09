using System.Diagnostics;
using System.Net.Security;
using System.Reflection;
using System.Security.Authentication;
using System.Security.Cryptography.X509Certificates;
using System.Text.Json;
using AssetMonitoringAgent;
using AssetMonitoringAgent.Security;
using AssetMonitoringAgent.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Http.Resilience;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.EventLog;
using Polly;

// =========================================================================
// Zero-Impact Performance: Lower Process Scheduling Priority
// Ensures OS scheduler prioritizes user applications & business workloads.
// =========================================================================
try
{
    using var currentProcess = Process.GetCurrentProcess();
    currentProcess.PriorityClass = ProcessPriorityClass.BelowNormal;
}
catch
{
    // Ignore if OS permissions deny priority adjustments in sandboxed environments
}

// =========================================================================
// Local Storage Security: Enforce Strict ACLs (SYSTEM & Admin only)
// =========================================================================
SecurityValidator.EnsureSecuredDirectory(@"C:\ProgramData\ITAssetAgent");
SecurityValidator.EnsureSecuredDirectory(@"C:\ProgramData\EnterpriseAssetAgent\Spool");

// =========================================================================
// CLI Utility Mode: --inspect / --dry-run and --protect-secret
// =========================================================================
if (args.Contains("--inspect") || args.Contains("--dry-run"))
{
    using var loggerFactory = LoggerFactory.Create(builder => builder.AddConsole().SetMinimumLevel(LogLevel.Information));
    var collectorLogger = loggerFactory.CreateLogger<HardwareCollectorService>();
    var collector = new HardwareCollectorService(collectorLogger);
    var version = Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "1.0.0";

    Console.WriteLine("==================================================================");
    Console.WriteLine($"  ENTERPRISE ASSET AGENT v{version}: HARDENED INSPECTION MODE     ");
    Console.WriteLine("==================================================================");

    var jsonOptions = new JsonSerializerOptions { WriteIndented = true };

    Console.WriteLine("\n[1/2] GATHERING TELEMETRY SNAPSHOT...");
    var telemetry = await collector.CollectTelemetryAsync();
    Console.WriteLine(JsonSerializer.Serialize(telemetry, jsonOptions));

    Console.WriteLine("\n[2/2] GATHERING FULL HARDWARE & SOFTWARE INVENTORY...");
    var inventory = await collector.CollectFullInventoryAsync();
    Console.WriteLine(JsonSerializer.Serialize(inventory, jsonOptions));

    Console.WriteLine("\nInspection complete. Exiting with status 0.");
    return;
}

if (args.Contains("--protect-secret"))
{
    int idx = Array.IndexOf(args, "--protect-secret");
    if (idx < args.Length - 1)
    {
        string rawSecret = args[idx + 1];
        using var loggerFactory = LoggerFactory.Create(b => b.AddConsole());
        var secretLogger = loggerFactory.CreateLogger<SecretStorageService>();
        var secretService = new SecretStorageService(secretLogger);

        string encrypted = secretService.ProtectSecret(rawSecret);
        Console.WriteLine("\nWindows DPAPI Machine Secret Encryption Succeeded.");
        Console.WriteLine("Paste this string into 'AgentSettings:ApiKeyEncrypted' in appsettings.json:\n");
        Console.WriteLine(encrypted);
        Console.WriteLine();
        return;
    }
    else
    {
        Console.Error.WriteLine("Error: Please provide secret to protect: --protect-secret <apiKey>");
        Environment.Exit(1);
    }
}

// =========================================================================
// Normal Service Mode: Windows Background Service Startup
// =========================================================================
var builder = Host.CreateApplicationBuilder(args);

// 1. Configure as a Windows Background Service
builder.Services.AddWindowsService(options =>
{
    options.ServiceName = "EnterpriseAssetAgent";
});

// 2. Configure Windows Event Log Provider
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
try
{
    builder.Logging.AddEventLog(new EventLogSettings
    {
        SourceName = "EnterpriseAssetAgent",
        LogName = "Application"
    });
}
catch
{
    // Ignore if running interactively in user session without event log rights
}

// 3. Register HTTP Client with Strict Egress Validation, TLS 1.2/1.3, Certificate Pinning & Polly Resilience
builder.Services.AddHttpClient("AssetApiClient", (sp, client) =>
{
    var config = builder.Configuration;
    string? baseUrl = config["AgentSettings:BaseApiUrl"];
    int timeoutSec = config.GetValue("AgentSettings:HttpTimeoutSeconds", 30);

    // Pillar 1: Anti-Data Exfiltration - Validate URL against internal allowlist before connection
    SecurityValidator.ValidateBackendUrl(baseUrl);

    client.BaseAddress = new Uri(baseUrl!.TrimEnd('/') + "/");
    client.Timeout = TimeSpan.FromSeconds(timeoutSec);
    client.DefaultRequestHeaders.Add("User-Agent", "Enterprise-Asset-Monitoring-Agent/1.0");
})
.ConfigurePrimaryHttpMessageHandler((sp) =>
{
    var config = sp.GetRequiredService<IConfiguration>();
    return new SocketsHttpHandler
    {
        // Enforce TLS 1.2 and TLS 1.3 only
        SslOptions = new SslClientAuthenticationOptions
        {
            EnabledSslProtocols = SslProtocols.Tls12 | SslProtocols.Tls13,
            RemoteCertificateValidationCallback = (sender, cert, chain, errors) =>
            {
                var cert2 = cert != null ? new X509Certificate2(cert) : null;
                return SecurityValidator.ValidateServerCertificate(sender as HttpRequestMessage, cert2, chain, errors, config);
            }
        },
        PooledConnectionLifetime = TimeSpan.FromMinutes(15),
        ConnectTimeout = TimeSpan.FromSeconds(10)
    };
})
.AddStandardResilienceHandler(options =>
{
    // Configure Exponential Backoff Retry Pipeline via Microsoft.Extensions.Http.Resilience
    options.Retry.MaxRetryAttempts = 3;
    options.Retry.BackoffType = DelayBackoffType.Exponential;
    options.Retry.Delay = TimeSpan.FromSeconds(2);
    options.TotalRequestTimeout.Timeout = TimeSpan.FromSeconds(60);
});

// 4. Register Domain & System Services
builder.Services.AddSingleton<ISecretStorageService, SecretStorageService>();
builder.Services.AddSingleton<IOfflineSpoolingService, OfflineSpoolingService>();
builder.Services.AddSingleton<IHardwareCollectorService, HardwareCollectorService>();
builder.Services.AddSingleton<IUpdateService, UpdateService>();

// 5. Register Background Worker Service
builder.Services.AddHostedService<Worker>();

var host = builder.Build();
host.Run();
