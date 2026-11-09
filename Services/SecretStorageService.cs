using System.Runtime.Versioning;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Logging;

namespace AssetMonitoringAgent.Services;

[SupportedOSPlatform("windows")]
public class SecretStorageService : ISecretStorageService
{
    private readonly ILogger<SecretStorageService> _logger;
    private static readonly byte[] Entropy = "Enterprise-Asset-Agent-Salt-v1"u8.ToArray();

    public SecretStorageService(ILogger<SecretStorageService> logger)
    {
        _logger = logger;
    }

    public string ProtectSecret(string plainSecret)
    {
        byte[] plainBytes = Encoding.UTF8.GetBytes(plainSecret);
        byte[] cipherBytes = ProtectedData.Protect(plainBytes, Entropy, DataProtectionScope.LocalMachine);
        return Convert.ToBase64String(cipherBytes);
    }

    public string? UnprotectSecret(string encryptedBase64)
    {
        if (string.IsNullOrWhiteSpace(encryptedBase64)) return null;

        try
        {
            byte[] cipherBytes = Convert.FromBase64String(encryptedBase64);
            byte[] plainBytes = ProtectedData.Unprotect(cipherBytes, Entropy, DataProtectionScope.LocalMachine);
            return Encoding.UTF8.GetString(plainBytes);
        }
        catch (CryptographicException ex)
        {
            _logger.LogError(ex, "Failed to decrypt API key with Windows DPAPI. Ensure key was sealed on this machine.");
            return null;
        }
    }
}

