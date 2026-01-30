@echo off
echo Starting NEET Analysis System...

:: Start Backend Server
cd /d "f:\Projects\NEET Analysis\SERVER"
start "NEET Backend" npm start

:: Start Frontend Client
cd /d "f:\Projects\NEET Analysis\client"
start "NEET Frontend" npm run dev

echo Application started! Minizing in 5 seconds...
timeout /t 5