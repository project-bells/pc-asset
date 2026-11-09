<#
.SYNOPSIS
    Uninstalls the Enterprise Asset Monitoring Agent Windows Service and cleans up files.
#>

[CmdletBinding()]
param(
    [string]$ServiceName = "EnterpriseAssetAgent",
    [string]$InstallDir = "C:\Program Files\EnterpriseAssetAgent",
    [switch]$KeepLogsAndSpool
)

$ErrorActionPreference = "Stop"

# Require Elevation
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "This script must be executed as Administrator."
    exit 1
}

Write-Host "Stopping and removing $ServiceName..." -ForegroundColor Yellow

if (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue) {
    Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    & sc.exe delete $ServiceName | Out-Null
    Write-Host "Service unregistered successfully." -ForegroundColor Green
}

if (Test-Path $InstallDir) {
    Remove-Item -Path $InstallDir -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "Installation directory removed: $InstallDir" -ForegroundColor Green
}

if (-not $KeepLogsAndSpool) {
    $spoolDir = "C:\ProgramData\EnterpriseAssetAgent"
    if (Test-Path $spoolDir) {
        Remove-Item -Path $spoolDir -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "Spool directory cleaned up: $spoolDir" -ForegroundColor Green
    }
}

Write-Host "Uninstallation complete." -ForegroundColor Green

