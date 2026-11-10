@echo off
title IT Asset Guard - Frontend Web Portal (Port 3000)
set "PATH=C:\Users\meetingroom\.nodejs\node-v20.18.0-win-x64;%PATH%"
set "PORT=3000"
set "HOSTNAME=0.0.0.0"
cd /d "C:\Users\meetingroom\Desktop\Programs-iBell\Frontend"
echo Starting Frontend Web Portal on port 3000...
node .next/standalone/server.js
pause

