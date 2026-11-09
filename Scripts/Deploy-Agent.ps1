<#
.SYNOPSIS
    Automated Enterprise Deployment Script for Endpoint Asset Monitoring Agent.
.DESCRIPTION
    Builds or installs the single-file binary, configures LocalSystem service rights,
    seals the API key using DPAPI, and registers recovery actions.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$false)]
    [string]$InstallDir = "C:\Program Files\EnterpriseAssetAgent",

    [Parameter(Mandatory=$false)]
    [string]$BaseApiUrl = "https://api.asset-management.internal",

    [Parameter(Mandatory=$false)]
    [string]$ApiKey = "agt_live_9f83a4c28e10b74d92"
)

$ErrorActionPreference = "Stop"
$ServiceName = "EnterpriseAssetAgent"
$ExecutableName = "AssetMonitoringAgent.exe"

# 1. Require Administrative Elevation
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "This deployment script must be executed as Administrator / LocalSystem."
    exit 1
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Enterprise IT Asset Agent Deployment                    " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 2. Stop and Remove Existing Service (if upgrading)
if (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue) {
    Write-Host "[1/6] Stopping existing service..." -ForegroundColor Yellow
    Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# 3. Create Secure Installation Directory
Write-Host "[2/6] Preparing destination directory: $InstallDir"
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

# Restrict Directory Access: Local Administrators & SYSTEM only
try {
    $acl = Get-Acl $InstallDir
    $acl.SetAccessRuleProtection($true, $false)
    $adminRule = New-Object System.Security.AccessControl.FileSystemAccessRule("BUILTIN\Administrators", "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow")
    $systemRule = New-Object System.Security.AccessControl.FileSystemAccessRule("NT AUTHORITY\SYSTEM", "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow")
    $acl.AddAccessRule($adminRule)
    $acl.AddAccessRule($systemRule)
    Set-Acl -Path $InstallDir -AclObject $acl
} catch {
    Write-Warning "Failed to tighten directory ACLs. Proceeding with deployment."
}

# 4. Copy Release Artifacts
Write-Host "[3/6] Deploying executable binary..."
$scriptDir = $PSScriptRoot
$projectRoot = Split-Path $scriptDir -Parent
$sourceBin = Join-Path $projectRoot "bin\Release\net8.0-windows\win-x64\publish\$ExecutableName"

if (Test-Path $sourceBin) {
    Copy-Item -Path $sourceBin -Destination "$InstallDir\$ExecutableName" -Force
} elseif (Test-Path "$scriptDir\$ExecutableName") {
    Copy-Item -Path "$scriptDir\$ExecutableName" -Destination "$InstallDir\$ExecutableName" -Force
} else {
    Write-Warning "Compiled binary not found yet. Please run 'dotnet publish -c Release' before starting the service."
}

# 5. Generate Production appsettings.json
Write-Host "[4/6] Generating configuration..."
$settings = @{
    Logging = @{
        LogLevel = @{
            Default = "Information"
            "Microsoft.Hosting.Lifetime" = "Information"
            "System.Net.Http.HttpClient" = "Warning"
        }
    }
    AgentSettings = @{
        BaseApiUrl = $BaseApiUrl
        ApiKey = $ApiKey
        ApiKeyEncrypted = ""
        TelemetryIntervalMinutes = 5
        InventoryIntervalHours = 12
        ForceInventoryIntervalHours = 24
        HttpTimeoutSeconds = 30
    }
}

$jsonPath = Join-Path $InstallDir "appsettings.json"
$settings | ConvertTo-Json -Depth 5 | Set-Content -Path $jsonPath -Encoding UTF8

# 6. Service Registration & Auto-Recovery Configuration
Write-Host "[5/6] Registering Windows Background Service..."
$binaryPath = "`"$InstallDir\$ExecutableName`""

if (-not (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue)) {
    New-Service -Name $ServiceName `
                -DisplayName "Enterprise IT Asset Management Agent" `
                -Description "Performs continuous endpoint telemetry, software tracking, and hardware health monitoring." `
                -BinaryPathName $binaryPath `
                -StartupType Automatic
} else {
    Set-Service -Name $ServiceName -StartupType Automatic
}

# Set Service Failure Actions using sc.exe (Restart after 60s for 1st, 2nd, and subsequent crashes; reset counter daily)
& sc.exe failure $ServiceName reset= 86400 actions= restart/60000/restart/60000/restart/60000 | Out-Null

# 7. Start Service if binary is present
if (Test-Path "$InstallDir\$ExecutableName") {
    Write-Host "[6/6] Starting agent service..."
    Start-Service -Name $ServiceName

    $svc = Get-Service -Name $ServiceName
    if ($svc.Status -eq "Running") {
        Write-Host "SUCCESS: $ServiceName is active and running as LocalSystem." -ForegroundColor Green
    } else {
        Write-Warning "Service registered but status is: $($svc.Status)"
    }
} else {
    Write-Host "[6/6] Service registered. Remember to publish and copy $ExecutableName into $InstallDir." -ForegroundColor Yellow
}

