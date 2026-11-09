@echo off
title IT Asset Monitoring Agent - Test Console
cd /d "%~dp0"
echo =======================================================
echo   IT Asset Monitoring Agent - Test Console
echo   Target Backend: http://192.168.27.145:5000
echo =======================================================
echo.
echo Starting agent in console mode. Press Ctrl+C to stop...
echo.
AssetMonitoringAgent.exe
pause

