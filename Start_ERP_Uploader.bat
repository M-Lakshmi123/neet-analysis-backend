@echo off
title NEET ERP Uploader

:: Change to the correct project directory
:: Note: Updated path to match the actual location of the server code
cd /d "f:\Projects\NEET Analysis"

echo Starting ERP Auto-Uploader...
echo Watching: F:\Project files\Error report.csv
echo.

echo ------------------------------------------------------------
set /p skip="[OPTIONAL] Enter number of rows to skip (or press ENTER to start from beginning/checkpoint): "
if not "%skip%"=="" (
    echo.
    echo [SKIP MODE] Starting uploader, skipping first %skip% records...
    set SKIP_RECORDS=%skip%
) else (
    echo.
    echo [NORMAL MODE] Starting uploader from beginning or last checkpoint...
    set SKIP_RECORDS=
)
echo ------------------------------------------------------------
echo.

:: Run the script
if exist "server\auto_upload_erp.js" (
    node server/auto_upload_erp.js
) else (
    echo.
    echo ---------------------------------------------------------------------
    echo ERROR: 'server\auto_upload_erp.js' not found!
    echo Current Directory is: %CD%
    echo Expected to find the script at: f:\Projects\NEET Analysis\server\auto_upload_erp.js
    echo ---------------------------------------------------------------------
    echo.
)

pause
