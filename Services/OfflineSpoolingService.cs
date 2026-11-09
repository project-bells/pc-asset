using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace AssetMonitoringAgent.Services;

public class OfflineSpoolingService : IOfflineSpoolingService
{
    private readonly ILogger<OfflineSpoolingService> _logger;
    private readonly string _spoolDir;
    private const long MaxSpoolSizeBytes = 50 * 1024 * 1024; // 50 MB safety cap
    private readonly SemaphoreSlim _drainLock = new(1, 1);

    public record SpooledItem(string Endpoint, string Base64Payload, DateTime EnqueuedUtc);

    public OfflineSpoolingService(ILogger<OfflineSpoolingService> logger)
    {
        _logger = logger;
        string preferredDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
            "EnterpriseAssetAgent",
            "Spool"
        );

        try
        {
            Directory.CreateDirectory(preferredDir);
            string testFile = Path.Combine(preferredDir, $".perm_{Guid.NewGuid():N}.tmp");
            File.WriteAllText(testFile, "ok");
            File.Delete(testFile);
            _spoolDir = preferredDir;
        }
        catch
        {
            string fallbackDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "EnterpriseAssetAgent",
                "Spool"
            );
            Directory.CreateDirectory(fallbackDir);
            _spoolDir = fallbackDir;
        }
    }

    public async Task EnqueueAsync(string endpoint, byte[] payload)
    {
        try
        {
            EnforceStorageQuota();

            var item = new SpooledItem(endpoint, Convert.ToBase64String(payload), DateTime.UtcNow);
            string fileName = $"{DateTime.UtcNow.Ticks}_{Guid.NewGuid():N}.spool";
            string filePath = Path.Combine(_spoolDir, fileName);

            byte[] jsonBytes = JsonSerializer.SerializeToUtf8Bytes(item);
            await File.WriteAllBytesAsync(filePath, jsonBytes);

            _logger.LogWarning("Endpoint offline. Telemetry payload spooled locally: {FileName}", fileName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to spool telemetry payload to local cache.");
        }
    }

    public async Task DrainQueueAsync(Func<string, byte[], Task<bool>> sendFunc, CancellationToken ct)
    {
        if (!await _drainLock.WaitAsync(0, ct))
            return; // Drain cycle already in flight

        try
        {
            List<string> files;
            try
            {
                if (!Directory.Exists(_spoolDir)) return;
                files = Directory.GetFiles(_spoolDir, "*.spool")
                                 .OrderBy(f => f)
                                 .ToList();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Unable to inspect spool directory {Dir}.", _spoolDir);
                return;
            }

            if (files.Count == 0) return;

            _logger.LogInformation("Processing {Count} spooled telemetry payloads from disk backlog.", files.Count);

            foreach (var file in files)
            {
                if (ct.IsCancellationRequested) break;

                try
                {
                    byte[] bytes = await File.ReadAllBytesAsync(file, ct);
                    var item = JsonSerializer.Deserialize<SpooledItem>(bytes);

                    if (item is not null)
                    {
                        byte[] rawPayload = Convert.FromBase64String(item.Base64Payload);
                        bool delivered = await sendFunc(item.Endpoint, rawPayload);

                        if (delivered)
                        {
                            File.Delete(file);
                        }
                        else
                        {
                            _logger.LogWarning("Server still unreachable during backlog drain. Pausing queue processing.");
                            break;
                        }
                    }
                    else
                    {
                        File.Delete(file); // Delete corrupt item
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to process spooled record {File}. Removing file.", file);
                    try { File.Delete(file); } catch { }
                }
            }
        }
        finally
        {
            _drainLock.Release();
        }
    }

    private void EnforceStorageQuota()
    {
        try
        {
            if (!Directory.Exists(_spoolDir)) return;
            var dirInfo = new DirectoryInfo(_spoolDir);
            long currentSize = dirInfo.EnumerateFiles("*.spool").Sum(f => f.Length);

            if (currentSize >= MaxSpoolSizeBytes)
            {
                // Drop oldest 50 files to prevent unbounded disk growth
                var oldest = dirInfo.EnumerateFiles("*.spool")
                                    .OrderBy(f => f.CreationTimeUtc)
                                    .Take(50);

                foreach (var file in oldest)
                {
                    try { file.Delete(); } catch { }
                }

                _logger.LogWarning("Spool directory reached quota limit. Oldest telemetry records pruned.");
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Storage quota check skipped due to file access limitation.");
        }
    }
}
