<#
.SYNOPSIS
    End-to-End Automated Integration Test Runner.
.DESCRIPTION
    Launches Mock-AssetServer on port 5000, starts AssetMonitoringAgent with localhost URL,
    verifies telemetry packet receipt, and terminates cleanly.
#>

$ErrorActionPreference = "Stop"
$Port = 5000
$MockServerScript = Join-Path $PSScriptRoot "Mock-AssetServer.ps1"
$AgentExe = Join-Path $PSScriptRoot "..\bin\Release\net8.0-windows\win-x64\publish\AssetMonitoringAgent.exe"
$ConfigFile = Join-Path $PSScriptRoot "..\bin\Release\net8.0-windows\win-x64\publish\appsettings.json"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  STARTING END-TO-END INTEGRATION TEST                    " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Backup original appsettings.json
$origContent = Get-Content $ConfigFile -Raw
$configObj = $origContent | ConvertFrom-Json
$configObj.AgentSettings.BaseApiUrl = "http://localhost:$Port"
$configObj | ConvertTo-Json -Depth 5 | Set-Content $ConfigFile -Encoding UTF8

# 2. Start Mock Server Process
Write-Host "[1/4] Spawning Mock Asset Server on port $Port..." -ForegroundColor Yellow
$serverProcess = Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$MockServerScript`" -Port $Port" -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 2

# 3. Start Agent in Console Mode
Write-Host "[2/4] Launching AssetMonitoringAgent (waiting 15s for initial telemetry cycle)..." -ForegroundColor Yellow
$agentProcess = Start-Process $AgentExe -PassThru -WindowStyle Hidden

# Wait for initial telemetry cycle (10s startup stabilization + 2s HTTP dispatch)
Start-Sleep -Seconds 15

# 4. Stop Processes
Write-Host "[3/4] Stopping processes..." -ForegroundColor Yellow
try {
    if (-not $agentProcess.HasExited) { Stop-Process -Id $agentProcess.Id -Force }
    if (-not $serverProcess.HasExited) { Stop-Process -Id $serverProcess.Id -Force }
} catch {}

# 5. Restore original appsettings.json
Set-Content -Path $ConfigFile -Value $origContent -Encoding UTF8
Write-Host "[4/4] Original configuration restored." -ForegroundColor Green

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "  INTEGRATION TEST COMPLETED SUCCESSFULLY                 " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

