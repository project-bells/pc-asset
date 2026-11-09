$ErrorActionPreference = 'Continue'

$nodeDir = "C:\Users\meetingroom\.nodejs\node-v20.18.0-win-x64"
$env:PATH = "$nodeDir;$env:PATH"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host " 🚀 ENTERPRISE IT ASSET GUARD: FULL-STACK INTEGRATION TEST SUITE " -ForegroundColor Cyan
Write-Host "=================================================================`n" -ForegroundColor Cyan

$backendDir = "C:\Users\meetingroom\Desktop\Programs-iBell\BackendAPI"
$frontendDir = "C:\Users\meetingroom\Desktop\Programs-iBell\Frontend"

$passCount = 0
$totalCount = 0

function Report-Step($name, $success, $detail = "") {
    $global:totalCount++
    if ($success) {
        $global:passCount++
        Write-Host "  ✅ [PASS] $name" -ForegroundColor Green
        if ($detail) { Write-Host "           $detail" -ForegroundColor Gray }
    } else {
        Write-Host "  ❌ [FAIL] $name" -ForegroundColor Red
        if ($detail) { Write-Host "           $detail" -ForegroundColor DarkYellow }
    }
}

# -------------------------------------------------------------
# STEP 1: Backend Unit Tests & AppSec Hardening
# -------------------------------------------------------------
Write-Host "▶️ STEP 1: Running Backend Unit Tests & AppSec Checks..." -ForegroundColor Yellow
Push-Location $backendDir
$backendTestOutput = cmd.exe /c "npm test 2>&1"
Pop-Location

$backendTestsOk = ($LASTEXITCODE -eq 0) -and ($backendTestOutput -match "6 / 6 Passed")
Report-Step "Backend AppSec & Tamper Detection Suite (6/6 Tests)" $backendTestsOk "Zod, XSS Sanitization, HMAC-SHA256, Replay, Constant-time Key, Tamper Logic"

# -------------------------------------------------------------
# STEP 2: Boot Backend API Server on Port 5000 & Test HTTP Endpoints
# -------------------------------------------------------------
Write-Host "`n▶️ STEP 2: Testing Backend API Live Server on Port 5000..." -ForegroundColor Yellow
$backendProcess = Start-Process -FilePath "node.exe" -ArgumentList "dist/server.js" -WorkingDirectory $backendDir -PassThru -WindowStyle Hidden

Start-Sleep -Seconds 3

try {
    # 2.1 Health Check (Expect 200 if DB is online, or 503 degraded if DB is offline)
    $healthOk = $false
    $healthDetail = ""
    try {
        $req = [System.Net.HttpWebRequest]::Create("http://localhost:5000/health")
        $req.Timeout = 5000
        $res = $req.GetResponse()
        $healthOk = $true
        $healthDetail = "HTTP 200 Healthy (Server & Database Online)"
    } catch [System.Net.WebException] {
        $res = $_.Exception.Response
        if ($res -and ($res.StatusCode.value__ -eq 503)) {
            $healthOk = $true
            $healthDetail = "HTTP 503 Degraded (Engine listening on Port 5000; accurately reports DB is offline)"
        } else {
            $healthDetail = $_.Exception.Message
        }
    }
    Report-Step "Backend Live /health Diagnostics" $healthOk $healthDetail
} catch {
    Report-Step "Backend Live /health Diagnostics" $false $_.Exception.Message
}

try {
    # 2.2 Security Check: Unauthenticated request should return 401
    $authBlocked = $false
    try {
        Invoke-RestMethod -Uri "http://localhost:5000/api/v1/agent/inventory" -Method Post -TimeoutSec 5 -ErrorAction Stop
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 401) {
            $authBlocked = $true
        }
    }
    Report-Step "AppSec Enforcement: Missing X-Api-Key triggers HTTP 401 Unauthorized" $authBlocked "Zero unauthenticated ingestion permitted"
} catch {
    Report-Step "AppSec Enforcement: Missing X-Api-Key" $false $_.Exception.Message
}

# -------------------------------------------------------------
# STEP 3: Boot Frontend Next.js Server on Port 3000 & Test Routes
# -------------------------------------------------------------
Write-Host "`n▶️ STEP 3: Testing Frontend Web Portal Live Server on Port 3000..." -ForegroundColor Yellow
Push-Location $frontendDir
$frontendProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run start -- -p 3000" -WorkingDirectory $frontendDir -PassThru -WindowStyle Hidden
Pop-Location

Start-Sleep -Seconds 6

$routesToTest = @(
    "/dashboard",
    "/assets",
    "/assets/print-qr",
    "/alerts",
    "/scan",
    "/pm"
)

foreach ($route in $routesToTest) {
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:3000$route" -UseBasicParsing -TimeoutSec 8 -ErrorAction Stop
        $is200 = $resp.StatusCode -eq 200
        Report-Step "Frontend Route HTTP 200: $route" $is200 "Rendered successfully ($($resp.Content.Length) bytes)"
    } catch {
        Report-Step "Frontend Route HTTP 200: $route" $false $_.Exception.Message
    }
}

# -------------------------------------------------------------
# CLEANUP
# -------------------------------------------------------------
Write-Host "`n🧹 Gracefully shutting down test server processes..." -ForegroundColor Yellow

if ($backendProcess -and !$backendProcess.HasExited) {
    Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue
}
if ($frontendProcess -and !$frontendProcess.HasExited) {
    Stop-Process -Id $frontendProcess.Id -Force -ErrorAction SilentlyContinue
}

# Kill any lingering node instances on ports 3000/5000
Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*$nodeDir*" } | Stop-Process -Force -ErrorAction SilentlyContinue

$pct = [math]::Round(($passCount / $totalCount) * 100)
Write-Host "`n=================================================================" -ForegroundColor Cyan
Write-Host " 📊 FINAL TEST RESULTS: $passCount / $totalCount Passed ($pct %)" -ForegroundColor $(if ($passCount -eq $totalCount) { "Green" } else { "Red" })
Write-Host "=================================================================`n" -ForegroundColor Cyan

if ($passCount -ne $totalCount) {
    exit 1
}
