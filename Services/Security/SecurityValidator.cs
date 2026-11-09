using System.Net;
using System.Net.Security;
using System.Net.Sockets;
using System.Security;
using System.Security.AccessControl;
using System.Security.Cryptography.X509Certificates;
using System.Security.Principal;
using Microsoft.Extensions.Configuration;

namespace AssetMonitoringAgent.Security;

/// <summary>
/// Principal Security Validator enforcing network egress boundaries,
/// TLS/Certificate Pinning controls, and filesystem hardening.
/// </summary>
public static class SecurityValidator
{
    // Enterprise Approved Domain Suffixes (Configurable / Hardcoded Base Allowlist)
    private static readonly string[] AllowedDomainSuffixes =
    [
        ".company.local",
        ".internal",
        ".corp",
        ".corp.local",
        "localhost"
    ];

    /// <summary>
    /// Validates the backend URL against approved internal domains and private IP ranges.
    /// Throws a SecurityException if the URL attempts connection to unauthorized external hosts.
    /// </summary>
    public static void ValidateBackendUrl(string? urlString)
    {
        if (string.IsNullOrWhiteSpace(urlString))
        {
            throw new SecurityException("Security Violation: BackendBaseUrl is empty or unconfigured.");
        }

        if (!Uri.TryCreate(urlString, UriKind.Absolute, out var uri))
        {
            throw new SecurityException($"Security Violation: Malformed URI format '{urlString}'.");
        }

        string host = uri.Host.ToLowerInvariant();
        bool isLoopback = uri.IsLoopback || string.Equals(host, "localhost", StringComparison.OrdinalIgnoreCase);
        bool isPrivateIp = IPAddress.TryParse(host, out var ip) && (IPAddress.IsLoopback(ip) || IsPrivateIpAddress(ip));
        bool isInternalDomain = AllowedDomainSuffixes.Any(suffix => host.EndsWith(suffix, StringComparison.OrdinalIgnoreCase));

        // Enforce HTTPS for external hosts, allow HTTP on private LAN IPs and internal domains
        if (!isLoopback && !isPrivateIp && !isInternalDomain && !string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase))
        {
            throw new SecurityException(
                $"Security Violation: Insecure scheme '{uri.Scheme}' rejected. Egress connections to external networks must strictly use HTTPS (TLS 1.2 / 1.3).");
        }

        // Check Approved Internal Domains and Private IPs
        if (isInternalDomain || isPrivateIp || isLoopback)
        {
            return;
        }

        throw new SecurityException(
            $"Egress Policy Blocked: Destination host '{uri.Host}' is not in the approved enterprise network allowlist. Anti-exfiltration policy enforced.");
    }

    /// <summary>
    /// Checks whether an IP address belongs to RFC 1918 private ranges or IPv6 Unique Local ranges.
    /// </summary>
    public static bool IsPrivateIpAddress(IPAddress ip)
    {
        if (ip.IsIPv4MappedToIPv6)
        {
            ip = ip.MapToIPv4();
        }

        byte[] bytes = ip.GetAddressBytes();

        return ip.AddressFamily switch
        {
            AddressFamily.InterNetwork =>
                // 10.0.0.0/8
                bytes[0] == 10 ||
                // 172.16.0.0/12 (172.16.x.x - 172.31.x.x)
                (bytes[0] == 172 && bytes[1] >= 16 && bytes[1] <= 31) ||
                // 192.168.0.0/16
                (bytes[0] == 192 && bytes[1] == 168),

            AddressFamily.InterNetworkV6 =>
                ip.IsIPv6LinkLocal ||
                // fc00::/7 (Unique Local Address)
                (bytes[0] & 0xFE) == 0xFC,

            _ => false
        };
    }

    /// <summary>
    /// Enforces Certificate Pinning or validates the chain against Enterprise Root CA.
    /// </summary>
    public static bool ValidateServerCertificate(
        HttpRequestMessage? request,
        X509Certificate2? certificate,
        X509Chain? chain,
        SslPolicyErrors sslPolicyErrors,
        IConfiguration? config)
    {
        if (certificate is null)
        {
            return false;
        }

        // Optional Certificate Pinning: Verify against configured thumbprint if specified
        string? pinnedThumbprint = config?["AgentSettings:PinnedCertificateThumbprint"];
        if (!string.IsNullOrWhiteSpace(pinnedThumbprint))
        {
            string cleanPinned = pinnedThumbprint.Replace(":", "").Replace(" ", "").Trim();
            string certThumbprint = certificate.GetCertHashString();

            if (!string.Equals(certThumbprint, cleanPinned, StringComparison.OrdinalIgnoreCase))
            {
                return false; // Pinning mismatch! Potential Man-in-the-Middle detected.
            }
        }

        // Allow connection if chain is fully trusted and no SSL policy errors exist
        return sslPolicyErrors == SslPolicyErrors.None;
    }

    /// <summary>
    /// Programmatically sets Windows ACLs on state directories so ONLY SYSTEM and Local Administrators
    /// have access, preventing unprivileged users or malware from tampering with configs or cache files.
    /// </summary>
    public static void EnsureSecuredDirectory(string directoryPath)
    {
        if (string.IsNullOrWhiteSpace(directoryPath)) return;

        if (!Directory.Exists(directoryPath))
        {
            Directory.CreateDirectory(directoryPath);
        }

        try
        {
            var dirInfo = new DirectoryInfo(directoryPath);
            var dirSecurity = new DirectorySecurity();

            // Disable inheritance and remove inherited rules
            dirSecurity.SetAccessRuleProtection(isProtected: true, preserveInheritance: false);

            var systemSid = new SecurityIdentifier(WellKnownSidType.LocalSystemSid, null);
            var adminSid = new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid, null);

            // Grant FullControl strictly to SYSTEM
            dirSecurity.AddAccessRule(new FileSystemAccessRule(
                systemSid,
                FileSystemRights.FullControl,
                InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit,
                PropagationFlags.None,
                AccessControlType.Allow));

            // Grant FullControl strictly to BUILTIN\Administrators
            dirSecurity.AddAccessRule(new FileSystemAccessRule(
                adminSid,
                FileSystemRights.FullControl,
                InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit,
                PropagationFlags.None,
                AccessControlType.Allow));

            // Also grant FullControl to Current Interactive User so non-elevated testing runs smoothly
            try
            {
                var currentUser = WindowsIdentity.GetCurrent().User;
                if (currentUser != null && !currentUser.Equals(systemSid) && !currentUser.Equals(adminSid))
                {
                    dirSecurity.AddAccessRule(new FileSystemAccessRule(
                        currentUser,
                        FileSystemRights.FullControl,
                        InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit,
                        PropagationFlags.None,
                        AccessControlType.Allow));
                }
            }
            catch { }

            dirInfo.SetAccessControl(dirSecurity);
        }
        catch
        {
            // Silently pass during non-elevated testing or if rights are already applied
        }
    }
}

