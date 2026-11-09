@echo off
title Enterprise IT Asset Guard - Launcher
echo =================================================================
echo   Launching Enterprise IT Asset Guard (Port 5000 and 3000)
echo =================================================================
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-System.ps1"
pause

