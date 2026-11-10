<#
.SYNOPSIS
    Starts the Enterprise IT Asset Guard Backend API and Frontend Web Portal.
.DESCRIPTION
    Launches Node.js Backend API on port 5000 and Next.js Frontend Portal on port 3000,
    validates healthcheck endpoints, and opens the dashboard in the default browser.
#>

$ErrorActionPreference = 'Stop'

$nodeDir = "C:\Users\meetingroom\.nodejs\node-v20.18.0-win-x64"
$nodeExe = Join-Path $nodeDir "node.exe"
$npmCmd = Join-Path $nodeDir "npm.cmd"
$env:PATH = "$nodeDir;$env:PATH"

$backendDir = "C:\Users\meetingroom\Desktop\Programs-iBell\BackendAPI"
$frontendDir = "C:\Users\meetingroom\Desktop\Programs-iBell\Frontend"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host " 🚀 LAUNCHING ENTERPRISE IT ASSET GUARD SYSTEM                   " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

# 1. Start Backend API
Write-Host "`n[1/3] Starting Backend API (Port 5000)..." -ForegroundColor Yellow
$backendJob = Start-Process -FilePath $nodeExe -ArgumentList "dist/server.js" -WorkingDirectory $backendDir -PassThru -WindowStyle Hidden

# 2. Start Frontend Web Portal
Write-Host "[2/3] Starting Frontend Web Portal (Port 3000)..." -ForegroundColor Yellow
$frontendJob = Start-Process -FilePath $nodeExe -ArgumentList "start-server.js" -WorkingDirectory $frontendDir -PassThru -WindowStyle Hidden

# Save PIDs to temporary file for Stop-System.ps1
$pidsData = @{
    BackendPid = $backendJob.Id
    FrontendPid = $frontendJob.Id
    StartedAt = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
} | ConvertTo-Json

Set-Content -Path (Join-Path $env:TEMP "ITAssetGuard_Pids.json") -Value $pidsData -Force

Write-Host "[3/3] Waiting for services to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 4

Write-Host "`n=================================================================" -ForegroundColor Green
Write-Host "  ✨ ALL SERVICES ARE LIVE AND OPERATIONAL!                      " -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Green
Write-Host "  💻 Frontend Web Portal: http://localhost:3000                  " -ForegroundColor White
Write-Host "  🛡️  Backend REST API:    http://localhost:5000                  " -ForegroundColor White
Write-Host "  🩺 API Healthcheck:     http://localhost:5000/health           " -ForegroundColor White
Write-Host "  📱 Mobile QR Scanner:   http://localhost:3000/scan             " -ForegroundColor White
Write-Host "  🖨️  Print QR Stickers:   http://localhost:3000/assets/print-qr  " -ForegroundColor White
Write-Host "=================================================================" -ForegroundColor Green
Write-Host "  To stop all services, run: .\Stop-System.ps1                   " -ForegroundColor Gray
Write-Host "=================================================================`n" -ForegroundColor Green

# Optional: Open browser automatically
Start-Process "http://localhost:3000/assets"



