using System.Runtime.Versioning;
using System.Security.Cryptography;
using System.Text.Json;
using AssetMonitoringAgent.Models;
using AssetMonitoringAgent.Security;
using AssetMonitoringAgent.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace AssetMonitoringAgent;

[SupportedOSPlatform("windows")]
public class Worker : BackgroundService
{
    private static string PendingInventoryFilePath => GetPendingInventoryFilePath();

    private readonly ILogger<Worker> _logger;
    private readonly IHardwareCollectorService _collector;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly IOfflineSpoolingService _spooler;
    private readonly ISecretStorageService _secretStorage;
    private readonly IUpdateService _updateService;

    private string? _lastInventoryHash;
    private DateTime _lastInventorySentUtc = DateTime.MinValue;
    private readonly string _apiKey;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };

    public Worker(
        ILogger<Worker> logger,
        IHardwareCollectorService collector,
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        IOfflineSpoolingService spooler,
        ISecretStorageService secretStorage,
        IUpdateService updateService)
    {
        _logger = logger;
        _collector = collector;
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _spooler = spooler;
        _secretStorage = secretStorage;
        _updateService = updateService;

        // Resolve API Key: Try DPAPI Encrypted Key first, fallback to standard plaintext
        string? encryptedKey = _configuration["AgentSettings:ApiKeyEncrypted"];
        if (!string.IsNullOrWhiteSpace(encryptedKey))
        {
            _apiKey = _secretStorage.UnprotectSecret(encryptedKey) 
                      ?? _configuration["AgentSettings:ApiKey"] 
                      ?? string.Empty;
        }
        else
        {
            _apiKey = _configuration["AgentSettings:ApiKey"] ?? string.Empty;
        }
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Enterprise IT Asset Agent started successfully. Initializing concurrent background loops.");

        // Start all three background loops concurrently
        var telemetryTask = RunTelemetryLoopAsync(stoppingToken);
        var inventoryTask = RunInventoryLoopAsync(stoppingToken);
        var updateTask = RunUpdateCheckLoopAsync(stoppingToken);

        await Task.WhenAll(telemetryTask, inventoryTask, updateTask);
    }

    #region Loop 1: Health & Telemetry Loop (5 Minutes Default)

    private async Task RunTelemetryLoopAsync(CancellationToken stoppingToken)
    {
        int intervalMinutes = _configuration.GetValue("AgentSettings:TelemetryIntervalMinutes", 5);
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(intervalMinutes));

        _logger.LogInformation("Telemetry loop scheduled every {Interval} minute(s).", intervalMinutes);

        // Initial 10-second stabilization delay
        await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);

        do
        {
            try
            {
                _logger.LogDebug("Collecting lightweight telemetry metrics.");
                var telemetry = await _collector.CollectTelemetryAsync();

                byte[] payloadBytes = JsonSerializer.SerializeToUtf8Bytes(telemetry, JsonOptions);
                var response = await SendWithSpoolFallbackAsync("api/v1/agent/telemetry", payloadBytes, stoppingToken);

                if (response is not null && response.PendingCommands?.Count > 0)
                {
                    await ProcessServerCommandsAsync(response.PendingCommands, stoppingToken);
                }

                // If connection is healthy, drain any previously spooled offline backlog
                await _spooler.DrainQueueAsync(async (endpoint, data) => 
                    await DirectPostAsync(endpoint, data, stoppingToken) != null, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unhandled error during telemetry collection cycle.");
            }

        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    #endregion

    #region Loop 2: Full Inventory Loop (12 Hours Default & Pending Retry)

    private async Task RunInventoryLoopAsync(CancellationToken stoppingToken)
    {
        int intervalHours = _configuration.GetValue("AgentSettings:InventoryIntervalHours", 12);
        int forceIntervalHours = _configuration.GetValue("AgentSettings:ForceInventoryIntervalHours", 24);
        using var timer = new PeriodicTimer(TimeSpan.FromHours(intervalHours));

        _logger.LogInformation("Full Inventory loop scheduled every {Interval} hour(s) (Force resend: {Force}h).", 
            intervalHours, forceIntervalHours);

        // Pillar 2: Startup Jitter & Staggered Execution (2s in interactive mode, 30 to 180s for Windows Service)
        // Prevents boot storm and CPU/Disk thrashing during Windows logon.
        int jitterSeconds = Environment.UserInteractive ? 2 : Random.Shared.Next(30, 181);
        _logger.LogInformation("Applying startup jitter delay of {Jitter}s before initial inventory scan to prevent boot/logon contention.", jitterSeconds);
        await Task.Delay(TimeSpan.FromSeconds(jitterSeconds), stoppingToken);

        // Immediate run on service initialization after jitter
        await ExecuteInventoryCycleAsync(forceIntervalHours, stoppingToken);

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            await ExecuteInventoryCycleAsync(forceIntervalHours, stoppingToken);
        }
    }

    private async Task ExecuteInventoryCycleAsync(int forceIntervalHours, CancellationToken stoppingToken)
    {
        try
        {
            // 1. Retry Sending Previously Pending Inventory Snapshot If Present
            await RetryPendingInventorySnapshotAsync(stoppingToken);

            _logger.LogInformation("Scanning full system inventory (Hardware, Software, Monitors, EDR).");
            var inventory = await _collector.CollectFullInventoryAsync();

            byte[] jsonBytes = JsonSerializer.SerializeToUtf8Bytes(inventory, JsonOptions);
            string currentHash = Convert.ToHexString(SHA256.HashData(jsonBytes));

            bool isHashChanged = !string.Equals(currentHash, _lastInventoryHash, StringComparison.OrdinalIgnoreCase);
            bool isForceResendRequired = (DateTime.UtcNow - _lastInventorySentUtc) >= TimeSpan.FromHours(forceIntervalHours);

            if (isHashChanged || isForceResendRequired)
            {
                _logger.LogInformation("Inventory delta detected or forced cycle triggered. Transmitting payload...");

                var response = await DirectPostAsync("api/v1/agent/inventory", jsonBytes, stoppingToken);

                if (response is not null)
                {
                    _lastInventoryHash = currentHash;
                    _lastInventorySentUtc = DateTime.UtcNow;
                    _logger.LogInformation("Inventory successfully synchronized with backend. Checksum: {Hash}", currentHash);

                    // Clean up any remaining pending file
                    if (File.Exists(PendingInventoryFilePath))
                    {
                        File.Delete(PendingInventoryFilePath);
                    }
                }
                else
                {
                    // All HTTP retries failed: Save snapshot locally to C:\ProgramData\ITAssetAgent\pending_inventory.json
                    await SavePendingInventoryAsync(jsonBytes, stoppingToken);
                }
            }
            else
            {
                _logger.LogInformation("Inventory unchanged (Checksum: {Hash}). Transmission skipped.", currentHash);
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Clean service exit
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled error executing inventory cycle.");
        }
    }

    private async Task RetryPendingInventorySnapshotAsync(CancellationToken stoppingToken)
    {
        if (!File.Exists(PendingInventoryFilePath)) return;

        try
        {
            _logger.LogInformation("Found pending inventory file at {Path}. Attempting delivery...", PendingInventoryFilePath);
            byte[] pendingBytes = await File.ReadAllBytesAsync(PendingInventoryFilePath, stoppingToken);

            var response = await DirectPostAsync("api/v1/agent/inventory", pendingBytes, stoppingToken);
            if (response is not null)
            {
                _logger.LogInformation("Successfully delivered pending inventory snapshot. Removing local cache.");
                File.Delete(PendingInventoryFilePath);
                _lastInventorySentUtc = DateTime.UtcNow;
            }
            else
            {
                _logger.LogWarning("Pending inventory delivery failed. Will keep file for subsequent retry.");
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to read or deliver pending inventory file from {Path}.", PendingInventoryFilePath);
        }
    }

    private static string GetPendingInventoryFilePath()
    {
        string defaultPath = @"C:\ProgramData\ITAssetAgent\pending_inventory.json";
        try
        {
            string? dir = Path.GetDirectoryName(defaultPath);
            if (!string.IsNullOrEmpty(dir))
            {
                Directory.CreateDirectory(dir);
                string testFile = Path.Combine(dir, $".perm_{Guid.NewGuid():N}.tmp");
                File.WriteAllText(testFile, "ok");
                File.Delete(testFile);
            }
            return defaultPath;
        }
        catch
        {
            string fallbackDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "ITAssetAgent"
            );
            Directory.CreateDirectory(fallbackDir);
            return Path.Combine(fallbackDir, "pending_inventory.json");
        }
    }

    private async Task SavePendingInventoryAsync(byte[] jsonBytes, CancellationToken stoppingToken)
    {
        try
        {
            string? dir = Path.GetDirectoryName(PendingInventoryFilePath);
            if (!string.IsNullOrEmpty(dir))
            {
                // Pillar 4: Enforce strict ACLs on state directories
                SecurityValidator.EnsureSecuredDirectory(dir);
            }

            await File.WriteAllBytesAsync(PendingInventoryFilePath, jsonBytes, stoppingToken);
            _logger.LogWarning(
                "All HTTP retries failed for Full Inventory payload. Saved snapshot locally to {Path} for retry on next cycle.",
                PendingInventoryFilePath);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to persist pending inventory snapshot to {Path}.", PendingInventoryFilePath);
        }
    }

    #endregion

    #region Loop 3: Self-Updating Loop (6 Hours Default)

    private async Task RunUpdateCheckLoopAsync(CancellationToken stoppingToken)
    {
        int intervalHours = _configuration.GetValue("AgentSettings:UpdateCheckIntervalHours", 6);
        using var timer = new PeriodicTimer(TimeSpan.FromHours(intervalHours));

        _logger.LogInformation("Self-update check loop scheduled every {Interval} hour(s).", intervalHours);

        // Initial 45-second delay to avoid blocking startup telemetry
        await Task.Delay(TimeSpan.FromSeconds(45), stoppingToken);

        do
        {
            try
            {
                await _updateService.CheckAndApplyUpdateAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unhandled error during agent self-update cycle.");
            }

        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    #endregion

    #region HTTP & Spooling Pipeline

    private async Task<TelemetryServerResponse?> SendWithSpoolFallbackAsync(
        string endpoint, 
        byte[] payload, 
        CancellationToken stoppingToken)
    {
        var response = await DirectPostAsync(endpoint, payload, stoppingToken);

        if (response is null)
        {
            // Network failure or offline: Persist to encrypted disk spool
            await _spooler.EnqueueAsync(endpoint, payload);
        }

        return response;
    }

    private async Task<TelemetryServerResponse?> DirectPostAsync(
        string endpoint, 
        byte[] jsonBytes, 
        CancellationToken stoppingToken)
    {
        try
        {
            // Client uses Polly Exponential Backoff via AddStandardResilienceHandler in Program.cs
            var client = _httpClientFactory.CreateClient("AssetApiClient");
            using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
            request.Headers.Add("X-Api-Key", _apiKey);
            request.Content = new ByteArrayContent(jsonBytes);
            request.Content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/json");

            using var response = await client.SendAsync(request, stoppingToken);
            if (response.IsSuccessStatusCode)
            {
                var stream = await response.Content.ReadAsStreamAsync(stoppingToken);
                return await JsonSerializer.DeserializeAsync<TelemetryServerResponse>(stream, JsonOptions, stoppingToken);
            }

            _logger.LogWarning("Remote server rejected payload at {Endpoint} with status {StatusCode}", 
                endpoint, response.StatusCode);
            return null;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            _logger.LogWarning("Endpoint offline or request timed out contacting {Endpoint} ({Message})", 
                endpoint, ex.Message);
            return null;
        }
    }

    #endregion

    #region Server Command Execution Engine

    private async Task ProcessServerCommandsAsync(
        List<AgentCommandDirective> commands, 
        CancellationToken stoppingToken)
    {
        foreach (var cmd in commands)
        {
            if (stoppingToken.IsCancellationRequested) break;

            _logger.LogInformation("Executing server directive: [ID: {Id}, Action: {Action}]", cmd.CommandId, cmd.Action);
            string output = "Success";
            string status = "Completed";

            try
            {
                switch (cmd.Action.ToLowerInvariant())
                {
                    case "force_inventory":
                        await ExecuteInventoryCycleAsync(forceIntervalHours: 0, stoppingToken);
                        output = "Inventory scan executed on demand.";
                        break;

                    case "check_update":
                        bool updated = await _updateService.CheckAndApplyUpdateAsync(stoppingToken);
                        output = updated ? "Update applied. Agent restarting." : "Agent is already up-to-date.";
                        break;

                    case "restart_service":
                        output = "Agent scheduled restart initiated.";
                        _ = Task.Run(async () =>
                        {
                            await Task.Delay(2000);
                            Environment.Exit(0); // Windows Service Control Manager will restart the process
                        });
                        break;

                    default:
                        status = "UnknownCommand";
                        output = $"Action '{cmd.Action}' is not recognized by agent.";
                        break;
                }
            }
            catch (Exception ex)
            {
                status = "Failed";
                output = ex.Message;
            }

            // Report execution result back to the server
            var receipt = new CommandExecutionResult(cmd.CommandId, status, output, DateTime.UtcNow);
            byte[] receiptBytes = JsonSerializer.SerializeToUtf8Bytes(receipt, JsonOptions);
            await DirectPostAsync("api/v1/assets/commands/receipt", receiptBytes, stoppingToken);
        }
    }

    #endregion
}
