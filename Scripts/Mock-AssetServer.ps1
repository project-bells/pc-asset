<#
.SYNOPSIS
    Enhanced Mock Asset Ingestion & Update Server for Local Testing.
.DESCRIPTION
    Uses native .NET HttpListener to receive and inspect Telemetry & Inventory payloads,
    and serves mock agent update manifests on GET /api/v1/agent/version.
#>

[CmdletBinding()]
param(
    [int]$Port = 5000,
    [string]$ExpectedApiKey = "agt_live_9f83a4c28e10b74d92",
    [string]$MockLatestVersion = "1.0.0"
)

$prefix = "http://localhost:$Port/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
} catch {
    Write-Error "Failed to start HttpListener. Ensure port $Port is free or run as Administrator."
    exit 1
}

Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  Mock Asset Ingestion Server listening on $prefix        " -ForegroundColor Green
Write-Host "  Supported Endpoints:                                    " -ForegroundColor Green
Write-Host "    POST /api/v1/assets/telemetry                         " -ForegroundColor Green
Write-Host "    POST /api/v1/assets/inventory                         " -ForegroundColor Green
Write-Host "    GET  /api/v1/agent/version                            " -ForegroundColor Green
Write-Host "  Press Ctrl+C to terminate the server.                   " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        $urlPath = $request.Url.AbsolutePath
        $httpMethod = $request.HttpMethod
        $apiKey = $request.Headers["X-Api-Key"]

        Write-Host "`n[$timestamp] $httpMethod $urlPath" -ForegroundColor Cyan
        Write-Host "  X-Api-Key Header: $apiKey" -ForegroundColor Gray

        # Route: GET /api/v1/agent/version
        if ($httpMethod -eq "GET" -and $urlPath -like "*version*") {
            $versionResponse = @{
                latestVersion = $MockLatestVersion
                downloadUrl   = "http://localhost:$Port/downloads/AssetMonitoringAgent.exe"
                sha256        = "E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855"
            } | ConvertTo-Json

            $buffer = [System.Text.Encoding]::UTF8.GetBytes($versionResponse)
            $response.ContentLength64 = $buffer.Length
            $response.ContentType = "application/json"
            $response.StatusCode = 200
            $output = $response.OutputStream
            $output.Write($buffer, 0, $buffer.Length)
            $output.Close()
            Write-Host "  Response: Served version manifest (v$MockLatestVersion)" -ForegroundColor Green
            continue
        }

        # Route: POST Payloads
        $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
        $body = $reader.ReadToEnd()

        if ($body) {
            try {
                $parsed = $body | ConvertFrom-Json
                Write-Host "  Payload received ($($body.Length) bytes):" -ForegroundColor White
                
                if ($urlPath -like "*telemetry*") {
                    Write-Host "    Hardware UUID: $($parsed.hardwareUuid)" -ForegroundColor Yellow
                    Write-Host "    Hostname:      $($parsed.hostname)" -ForegroundColor Yellow
                    Write-Host "    CPU Load:      $($parsed.cpuLoadPercent)%" -ForegroundColor Yellow
                    Write-Host "    RAM Used:      $($parsed.ramUsedPercent)%" -ForegroundColor Yellow
                    Write-Host "    Disks:         $($parsed.disks.Count) volume(s)" -ForegroundColor Yellow
                } elseif ($urlPath -like "*inventory*") {
                    Write-Host "    Manufacturer:  $($parsed.system.manufacturer)" -ForegroundColor Yellow
                    Write-Host "    Model:         $($parsed.system.model)" -ForegroundColor Yellow
                    Write-Host "    CPU:           $($parsed.cpu.model)" -ForegroundColor Yellow
                    Write-Host "    RAM Sticks:    $($parsed.memoryModules.Count)" -ForegroundColor Yellow
                    Write-Host "    Monitors:      $($parsed.monitors.Count)" -ForegroundColor Yellow
                    Write-Host "    Software:      $($parsed.installedSoftware.Count) application(s)" -ForegroundColor Yellow
                }
            } catch {
                Write-Host "  [Raw Body]: $body" -ForegroundColor DarkGray
            }
        }

        # Return standard success response
        $responseJson = '{"status":"ok","pendingCommands":[]}'
        $buffer = [System.Text.Encoding]::UTF8.GetBytes($responseJson)
        $response.ContentLength64 = $buffer.Length
        $response.ContentType = "application/json"
        $response.StatusCode = 200
        $output = $response.OutputStream
        $output.Write($buffer, 0, $buffer.Length)
        $output.Close()
    }
} finally {
    $listener.Stop()
    $listener.Close()
    Write-Host "`nServer stopped." -ForegroundColor Red
}
