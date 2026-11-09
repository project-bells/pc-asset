<#
.SYNOPSIS
    Endpoint Diagnostic & Health Check Utility for Enterprise Asset Agent.
.DESCRIPTION
    Verifies Service state, WMI repository integrity, Network connectivity to BaseApiUrl,
    Spool cache volume, and parses recent Windows Event Logs for errors.
#>

[CmdletBinding()]
param(
    [string]$ServiceName = "EnterpriseAssetAgent",
    [string]$InstallDir = "C:\Program Files\EnterpriseAssetAgent",
    [string]$SpoolDir = "C:\ProgramData\EnterpriseAssetAgent\Spool"
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  ENTERPRISE ASSET AGENT: ENDPOINT HEALTH CHECK           " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Service Status Check
Write-Host "`n[1/5] Checking Windows Service Status..." -ForegroundColor White
$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue

if ($null -eq $service) {
    Write-Host "  [-] Service '$ServiceName' is NOT INSTALLED." -ForegroundColor Red
} else {
    $statusColor = if ($service.Status -eq "Running") { "Green" } else { "Yellow" }
    Write-Host "  [+] Service Name:     $($service.DisplayName)" -ForegroundColor $statusColor
    Write-Host "  [+] Current Status:   $($service.Status)" -ForegroundColor $statusColor
    Write-Host "  [+] Startup Type:     $($service.StartType)" -ForegroundColor $statusColor
}

# 2. Configuration & API Endpoint Validation
Write-Host "`n[2/5] Validating Local Configuration & Network Reachability..." -ForegroundColor White
$configPath = Join-Path $InstallDir "appsettings.json"
if (Test-Path $configPath) {
    try {
        $config = Get-Content $configPath -Raw | ConvertFrom-Json
        $baseUrl = $config.AgentSettings.BaseApiUrl
        Write-Host "  [+] Target BaseApiUrl: $baseUrl" -ForegroundColor Gray

        if ($baseUrl -and $baseUrl -notlike "*internal*") {
            try {
                $ping = Invoke-WebRequest -Uri $baseUrl -Method Head -TimeoutSec 5 -ErrorAction Stop
                Write-Host "  [+] Server Reachability: OK (HTTP $($ping.StatusCode))" -ForegroundColor Green
            } catch {
                Write-Host "  [-] Warning: Cannot establish connection to $baseUrl ($($_.Exception.Message))" -ForegroundColor Yellow
            }
        } else {
            Write-Host "  [*] Using default/internal placeholder URL." -ForegroundColor DarkGray
        }
    } catch {
        Write-Host "  [-] Corrupt appsettings.json detected: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "  [-] Configuration file not found at: $configPath" -ForegroundColor Yellow
}

# 3. WMI Repository Health Check
Write-Host "`n[3/5] Checking WMI Repository Health..." -ForegroundColor White
try {
    $wmiTest = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction Stop
    Write-Host "  [+] WMI root\cimv2 is responding normally (OS: $($wmiTest.Caption))." -ForegroundColor Green
} catch {
    Write-Host "  [-] Critical: WMI query failed. Repository may be corrupted ($($_.Exception.Message))" -ForegroundColor Red
    Write-Host "      Remediation: Run 'winmgmt /salvagedb' in elevated command prompt." -ForegroundColor Yellow
}

# 4. Offline Spool Cache Inspection
Write-Host "`n[4/5] Inspecting Store-and-Forward Spool Cache..." -ForegroundColor White
if (Test-Path $SpoolDir) {
    $spoolFiles = Get-ChildItem -Path $SpoolDir -Filter "*.spool" -ErrorAction SilentlyContinue
    $totalBytes = ($spoolFiles | Measure-Object -Property Length -Sum).Sum
    $sizeMb = if ($totalBytes) { [math]::Round($totalBytes / 1MB, 2) } else { 0 }

    if ($spoolFiles.Count -gt 0) {
        Write-Host "  [*] Spool Backlog: $($spoolFiles.Count) pending payloads ($sizeMb MB queued)." -ForegroundColor Yellow
        Write-Host "      (Payloads will automatically flush when connection to server succeeds)" -ForegroundColor Gray
    } else {
        Write-Host "  [+] Spool Queue is clear (0 pending items)." -ForegroundColor Green
    }
} else {
    Write-Host "  [+] Spool directory is clean / not created yet." -ForegroundColor Green
}

# 5. Recent Windows Event Logs
Write-Host "`n[5/5] Reviewing Recent Agent Event Logs (Application Log)..." -ForegroundColor White
try {
    $events = Get-WinEvent -FilterHashtable @{LogName='Application'; ProviderName='EnterpriseAssetAgent'} -MaxEvents 5 -ErrorAction Stop
    foreach ($evt in $events) {
        $color = switch ($evt.LevelDisplayName) {
            "Error"   { "Red" }
            "Warning" { "Yellow" }
            default   { "Gray" }
        }
        Write-Host "  [$($evt.TimeCreated.ToString('HH:mm:ss'))] [$($evt.LevelDisplayName)] $($evt.Message)" -ForegroundColor $color
    }
} catch {
    Write-Host "  [*] No recent events found for provider 'EnterpriseAssetAgent'." -ForegroundColor DarkGray
}

Write-Host "`nHealth check finished.`n" -ForegroundColor Cyan

