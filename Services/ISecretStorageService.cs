namespace AssetMonitoringAgent.Services;

public interface ISecretStorageService
{
    string ProtectSecret(string plainSecret);
    string? UnprotectSecret(string encryptedBase64);
}

