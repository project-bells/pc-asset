@echo off
title Push to GitHub - project-bells/pc-asset
cd /d "%~dp0"
if exist "Programs-iBell\.git" cd /d "%~dp0Programs-iBell"

set "PATH=C:\Users\meetingroom\AppData\Local\Programs\Git\cmd;%PATH%"

echo =================================================================
echo   Pushing code to https://github.com/project-bells/pc-asset.git
echo =================================================================
echo.

git push -u origin main

echo.
echo =================================================================
if %errorlevel% equ 0 (
    echo [SUCCESS] Code pushed to GitHub successfully!
) else (
    echo [FAILED] Push failed. If authentication was requested, 
    echo please sign in with GitHub in your browser or enter a PAT token.
)
echo =================================================================
pause

