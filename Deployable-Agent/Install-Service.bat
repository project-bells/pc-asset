@echo off
setlocal
cd /d "%~dp0"

echo =======================================================
echo   IT Asset Monitoring Agent - Service Installer
echo =======================================================
echo.

:: Check Admin Rights
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Please run this batch script as Administrator!
    echo Right-click this file and choose "Run as administrator".
    pause
    exit /b 1
)

set SERVICE_NAME=ITAssetAgent
set DISPLAY_NAME=IT Asset Monitoring Agent
set BIN_PATH="%~dp0AssetMonitoringAgent.exe"

echo Stopping existing service if running...
sc stop %SERVICE_NAME% >nul 2>&1
sc delete %SERVICE_NAME% >nul 2>&1
timeout /t 2 /nobreak >nul 2>&1

echo Registering Windows Service %SERVICE_NAME%...
sc create %SERVICE_NAME% binPath= %BIN_PATH% start= delayed-auto DisplayName= "%DISPLAY_NAME%"
if %errorLevel% neq 0 (
    echo [FAILED] Unable to create service.
    pause
    exit /b 1
)

echo Configuring failure recovery actions...
sc failure %SERVICE_NAME% reset= 86400 actions= restart/60000/restart/120000/restart/300000

echo Starting service...
sc start %SERVICE_NAME%

echo.
echo =======================================================
echo [SUCCESS] IT Asset Agent service installed and started!
echo =======================================================
pause

