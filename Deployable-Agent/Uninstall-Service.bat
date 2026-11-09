@echo off
setlocal
cd /d "%~dp0"

echo =======================================================
echo   IT Asset Monitoring Agent - Service Uninstaller
echo =======================================================
echo.

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Please run this batch script as Administrator!
    echo Right-click this file and choose "Run as administrator".
    pause
    exit /b 1
)

set SERVICE_NAME=ITAssetAgent

echo Stopping service %SERVICE_NAME%...
sc stop %SERVICE_NAME% >nul 2>&1
timeout /t 2 /nobreak >nul 2>&1

echo Removing service %SERVICE_NAME%...
sc delete %SERVICE_NAME%

echo.
echo [SUCCESS] IT Asset Agent service removed successfully.
pause

