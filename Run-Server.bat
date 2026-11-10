@echo off
title IT Asset Guard - Backend API (Port 5000)
set "PATH=C:\Users\meetingroom\.nodejs\node-v20.18.0-win-x64;%PATH%"
cd /d "C:\Users\meetingroom\Desktop\Programs-iBell\BackendAPI"
echo Starting Backend API on port 5000...
node dist/server.js
pause

