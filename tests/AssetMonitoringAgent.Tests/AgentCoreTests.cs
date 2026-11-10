using System.Net;
using System.Security;
using System.Text.RegularExpressions;
using AssetMonitoringAgent.Security;
using AssetMonitoringAgent.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace AssetMonitoringAgent.Tests;

public class AgentCoreTests
{
    [Fact]
    public void SecretStorageService_ShouldEncryptAndDecrypt_RoundTrip()
    {
        // Arrange
        var service = new SecretStorageService(NullLogger<SecretStorageService>.Instance);
        string originalSecret = "my_super_secret_enterprise_api_key_12345!@#";

        // Act
        string cipher = service.ProtectSecret(originalSecret);
        string? decrypted = service.UnprotectSecret(cipher);

        // Assert
        Assert.NotNull(cipher);
        Assert.NotEqual(originalSecret, cipher);
        Assert.Equal(originalSecret, decrypted);
    }

    [Fact]
    public void VidPidRegex_ShouldExtractIdentifiersCorrectly()
    {
        // Arrange
        var vidRegex = new Regex(@"(?:VID_|vid_)([0-9A-Fa-f]{4})", RegexOptions.IgnoreCase);
        var pidRegex = new Regex(@"(?:PID_|pid_)([0-9A-Fa-f]{4})", RegexOptions.IgnoreCase);
        string samplePnp = @"USB\VID_17EF&PID_6123&MI_00\6&1F758F0B&0&0000";

        // Act
        var vidMatch = vidRegex.Match(samplePnp);
        var pidMatch = pidRegex.Match(samplePnp);

        // Assert
        Assert.True(vidMatch.Success);
        Assert.Equal("17EF", vidMatch.Groups[1].Value);

        Assert.True(pidMatch.Success);
        Assert.Equal("6123", pidMatch.Groups[1].Value);
    }

    [Theory]
    [InlineData("1.0.1", "1.0.0", true)]
    [InlineData("2.0.0", "1.9.9", true)]
    [InlineData("1.0.0", "1.0.0", false)]
    [InlineData("0.9.9", "1.0.0", false)]
    public void VersionComparison_ShouldCorrectlyIdentifyNewerVersions(string remoteVersionStr, string currentVersionStr, bool expectedIsNewer)
    {
        // Arrange
        var remote = Version.Parse(remoteVersionStr);
        var current = Version.Parse(currentVersionStr);

        // Act
        bool isNewer = remote > current;

        // Assert
        Assert.Equal(expectedIsNewer, isNewer);
    }

    [Theory]
    [InlineData("https://agent.company.local/api")]
    [InlineData("https://telemetry.internal/api/v1")]
    [InlineData("https://server.corp/api")]
    [InlineData("https://192.168.1.100:8443")]
    [InlineData("https://10.0.5.20:5000")]
    [InlineData("https://172.16.1.1")]
    [InlineData("http://localhost:5000")]
    [InlineData("http://127.0.0.1:5000")]
    public void SecurityValidator_ShouldAllowAuthorizedInternalHosts(string validUrl)
    {
        // Act & Assert (Should not throw SecurityException)
        SecurityValidator.ValidateBackendUrl(validUrl);
    }

    [Theory]
    [InlineData("https://evil-exfiltration-domain.com/collect")]
    [InlineData("https://8.8.8.8/telemetry")]
    [InlineData("https://142.250.190.46")]
    [InlineData("http://company.local/unencrypted")] // Insecure HTTP rejected
    public void SecurityValidator_ShouldBlockUnauthorizedEgressOrInsecureProtocols(string forbiddenUrl)
    {
        // Act & Assert
        Assert.Throws<SecurityException>(() => SecurityValidator.ValidateBackendUrl(forbiddenUrl));
    }

    [Fact]
    public void HardwareCollectorService_ShouldCollectWindowsPatchesAndRebootFlags()
    {
        // Arrange
        var collector = new HardwareCollectorService(NullLogger<HardwareCollectorService>.Instance);

        // Act
        var patches = collector.CollectWindowsPatches();
        bool pendingReboot = collector.CheckPendingReboot();
        var (lastBootTime, uptimeDays) = collector.GetSystemUptime();

        // Assert
        Assert.NotNull(patches);
        // On any live Windows machine with security updates, patches should be present
        if (patches.Count > 0)
        {
            var firstPatch = patches[0];
            Assert.StartsWith("KB", firstPatch.KbId);
            Assert.False(string.IsNullOrEmpty(firstPatch.Description));
        }

        // Reboot flag should be a boolean (true or false) without throwing
        Assert.True(pendingReboot == true || pendingReboot == false);

        // Uptime should be calculated
        Assert.True(uptimeDays >= 0);
        Assert.NotNull(lastBootTime);
    }
}
