@echo off
title Enterprise IT Asset Guard - Master Launcher
cd /d "%~dp0"
echo =================================================================
echo   Launching Enterprise IT Asset Guard Services
echo =================================================================

start "IT Asset Backend API (Port 5000)" cmd /k "%~dp0Run-Server.bat"
timeout /t 3 /nobreak >nul
start "IT Asset Frontend Portal (Port 3000)" cmd /k "%~dp0Run-Frontend.bat"
timeout /t 3 /nobreak >nul

start http://localhost:3000/assets
echo.
echo All services launched in background console windows!

