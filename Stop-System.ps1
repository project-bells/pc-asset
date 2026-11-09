<#
.SYNOPSIS
    Stops the Enterprise IT Asset Guard Backend API and Frontend Web Portal.
#>

$ErrorActionPreference = 'SilentlyContinue'

$nodeDir = "C:\Users\meetingroom\.nodejs\node-v20.18.0-win-x64"
$pidsFile = Join-Path $env:TEMP "ITAssetGuard_Pids.json"

Write-Host "=================================================================" -ForegroundColor Yellow
Write-Host " 🛑 STOPPING ENTERPRISE IT ASSET GUARD SERVICES                  " -ForegroundColor Yellow
Write-Host "=================================================================" -ForegroundColor Yellow

if (Test-Path $pidsFile) {
    $pids = Get-Content $pidsFile | ConvertFrom-Json
    if ($pids.BackendPid) {
        Write-Host "Stopping Backend API (PID: $($pids.BackendPid))..." -ForegroundColor Gray
        Stop-Process -Id $pids.BackendPid -Force -ErrorAction SilentlyContinue
    }
    if ($pids.FrontendPid) {
        Write-Host "Stopping Frontend Web Portal (PID: $($pids.FrontendPid))..." -ForegroundColor Gray
        Stop-Process -Id $pids.FrontendPid -Force -ErrorAction SilentlyContinue
    }
    Remove-Item $pidsFile -Force -ErrorAction SilentlyContinue
}

# Kill any remaining Node.js processes launched from our node portable path
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*$nodeDir*" }
foreach ($p in $nodeProcesses) {
    Write-Host "Stopping lingering Node.js process (PID: $($p.Id))..." -ForegroundColor Gray
    Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
}

Write-Host "`n✅ All Backend API and Frontend Web Portal processes have been stopped.`n" -ForegroundColor Green

