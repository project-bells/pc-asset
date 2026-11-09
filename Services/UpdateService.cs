using System.Diagnostics;
using System.Reflection;
using System.Security.Cryptography;
using System.Text.Json;
using AssetMonitoringAgent.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace AssetMonitoringAgent.Services;

public class UpdateService : IUpdateService
{
    private readonly ILogger<UpdateService> _logger;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly ISecretStorageService _secretStorage;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public UpdateService(
        ILogger<UpdateService> logger,
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        ISecretStorageService secretStorage)
    {
        _logger = logger;
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _secretStorage = secretStorage;
    }

    public async Task<bool> CheckAndApplyUpdateAsync(CancellationToken stoppingToken)
    {
        try
        {
            _logger.LogInformation("Checking for available agent updates via API...");

            var client = _httpClientFactory.CreateClient("AssetApiClient");

            // Attach authentication header
            string apiKey = ResolveApiKey();
            using var request = new HttpRequestMessage(HttpMethod.Get, "api/v1/agent/version");
            request.Headers.Add("X-Api-Key", apiKey);

            using var response = await client.SendAsync(request, stoppingToken);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Update check returned non-success HTTP status {StatusCode}.", response.StatusCode);
                return false;
            }

            var contentStream = await response.Content.ReadAsStreamAsync(stoppingToken);
            var versionInfo = await JsonSerializer.DeserializeAsync<AgentVersionResponse>(contentStream, JsonOptions, stoppingToken);

            if (versionInfo is null || string.IsNullOrWhiteSpace(versionInfo.LatestVersion))
            {
                _logger.LogWarning("Received empty or malformed version payload from server.");
                return false;
            }

            var currentVersion = Assembly.GetExecutingAssembly().GetName().Version ?? new Version(1, 0, 0);
            if (!Version.TryParse(versionInfo.LatestVersion, out var latestVersion))
            {
                _logger.LogWarning("Unable to parse remote version string '{Version}'.", versionInfo.LatestVersion);
                return false;
            }

            if (latestVersion <= currentVersion)
            {
                _logger.LogInformation("Agent is up to date (Installed: {Current}, Remote: {Remote}).", currentVersion, latestVersion);
                return false;
            }

            _logger.LogInformation("New version detected: v{NewVersion} (Current: v{CurrentVersion}). Downloading from {Url}...",
                latestVersion, currentVersion, versionInfo.DownloadUrl);

            return await DownloadAndApplyUpdateAsync(versionInfo, latestVersion, stoppingToken);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected failure occurred during agent self-update check.");
            return false;
        }
    }

    private async Task<bool> DownloadAndApplyUpdateAsync(
        AgentVersionResponse info, 
        Version latestVersion, 
        CancellationToken stoppingToken)
    {
        string tempDir = Path.GetTempPath();
        string tempExePath = Path.Combine(tempDir, $"EnterpriseAssetAgent_v{latestVersion}_{Guid.NewGuid():N}.exe");
        string batScriptPath = Path.Combine(tempDir, $"update_agent_{Guid.NewGuid():N}.bat");

        try
        {
            // 1. Download Binary
            var client = _httpClientFactory.CreateClient("AssetApiClient");
            using (var downloadResponse = await client.GetAsync(info.DownloadUrl, HttpCompletionOption.ResponseHeadersRead, stoppingToken))
            {
                downloadResponse.EnsureSuccessStatusCode();

                await using var remoteStream = await downloadResponse.Content.ReadAsStreamAsync(stoppingToken);
                await using var localFileStream = new FileStream(tempExePath, FileMode.Create, FileAccess.Write, FileShare.None);
                await remoteStream.CopyToAsync(localFileStream, stoppingToken);
            }

            _logger.LogInformation("Update payload downloaded successfully ({Size} bytes). Verifying SHA-256...", 
                new FileInfo(tempExePath).Length);

            // 2. Verify SHA-256 Checksum
            await using (var verifyStream = File.OpenRead(tempExePath))
            {
                byte[] hashBytes = await SHA256.HashDataAsync(verifyStream, stoppingToken);
                string calculatedHash = Convert.ToHexString(hashBytes);

                if (!string.Equals(calculatedHash, info.Sha256, StringComparison.OrdinalIgnoreCase))
                {
                    _logger.LogError(
                        "Security Warning: SHA-256 checksum mismatch! Expected: {Expected}, Computed: {Actual}. Aborting update.",
                        info.Sha256, calculatedHash);

                    File.Delete(tempExePath);
                    return false;
                }
            }

            _logger.LogInformation("SHA-256 Checksum verified ({Hash}). Preparing self-replacement batch launcher...", info.Sha256);

            // 3. Resolve Current Binary Location
            string? currentExePath = Environment.ProcessPath;
            if (string.IsNullOrWhiteSpace(currentExePath) || !File.Exists(currentExePath))
            {
                currentExePath = Path.Combine(AppContext.BaseDirectory, "AssetMonitoringAgent.exe");
            }

            // 4. Create Lightweight Batch Update Script
            string batContent = $@"@echo off
setlocal enabledelayedexpansion

echo [EnterpriseAssetAgent-Updater] Waiting for host process to exit...
timeout /t 3 /nobreak > nul

echo [EnterpriseAssetAgent-Updater] Stopping Windows Service...
sc.exe stop EnterpriseAssetAgent > nul 2>&1
timeout /t 2 /nobreak > nul

echo [EnterpriseAssetAgent-Updater] Overwriting target binary...
set RETRY_COUNT=0
:COPY_LOOP
copy /y ""{tempExePath}"" ""{currentExePath}"" > nul 2>&1
if errorlevel 1 (
    set /a RETRY_COUNT+=1
    if !RETRY_COUNT! LEQ 5 (
        timeout /t 2 /nobreak > nul
        goto COPY_LOOP
    )
)

echo [EnterpriseAssetAgent-Updater] Restarting Windows Service...
sc.exe start EnterpriseAssetAgent > nul 2>&1

echo [EnterpriseAssetAgent-Updater] Cleaning up temporary installer...
del /f /q ""{tempExePath}"" > nul 2>&1

rem Self-delete updater script
(goto) 2>nul & del ""%~f0""
";
            await File.WriteAllTextAsync(batScriptPath, batContent, stoppingToken);

            _logger.LogInformation("Spawning detached update process and terminating current service instance.");

            // 5. Spawn updater script detached and terminate current process
            var psi = new ProcessStartInfo
            {
                FileName = "cmd.exe",
                Arguments = $"/c \"{batScriptPath}\"",
                UseShellExecute = false,
                CreateNoWindow = true,
                WorkingDirectory = tempDir
            };

            Process.Start(psi);

            // Exit immediately so the Windows Service Control Manager releases file lock on the .exe
            Environment.Exit(0);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to apply agent binary update.");

            // Cleanup temp files if still present
            if (File.Exists(tempExePath)) File.Delete(tempExePath);
            if (File.Exists(batScriptPath)) File.Delete(batScriptPath);

            return false;
        }
    }

    private string ResolveApiKey()
    {
        string? encryptedKey = _configuration["AgentSettings:ApiKeyEncrypted"];
        if (!string.IsNullOrWhiteSpace(encryptedKey))
        {
            return _secretStorage.UnprotectSecret(encryptedKey) 
                   ?? _configuration["AgentSettings:ApiKey"] 
                   ?? string.Empty;
        }

        return _configuration["AgentSettings:ApiKey"] ?? string.Empty;
    }
}

