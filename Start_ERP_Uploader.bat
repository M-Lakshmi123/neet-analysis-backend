@echo off
title NEET ERP Uploader

:: Change to the correct project directory
:: Note: Updated path to match the actual location of the server code
cd /d "f:\NEET Analysis"

echo Starting ERP Auto-Uploader...
echo Watching: F:\Project files\Error report.csv
echo.

:: Run the script
if exist "server\auto_upload_erp.js" (
    node server/auto_upload_erp.js
) else (
    echo.
    echo ---------------------------------------------------------------------
    echo ERROR: 'server\auto_upload_erp.js' not found!
    echo Current Directory is: %CD%
    echo Expected to find the script at: f:\NEET Analysis\server\auto_upload_erp.js
    echo ---------------------------------------------------------------------
    echo.
)

pause
