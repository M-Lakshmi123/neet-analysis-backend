@echo off
title NEET Medical Result Uploader

:: Change to the correct project directory
cd /d "f:\NEET Analysis"

echo Starting Medical Result Auto-Uploader...
echo Watching: F:\Project files\MEDICAL_RESULT.csv
echo.

:: Run the script
if exist "server\auto_upload_medical.js" (
    node server/auto_upload_medical.js
) else (
    echo.
    echo ---------------------------------------------------------------------
    echo ERROR: 'server\auto_upload_medical.js' not found!
    echo Current Directory is: %CD%
    echo Expected to find the script at: f:\NEET Analysis\server\auto_upload_medical.js
    echo ---------------------------------------------------------------------
    echo.
)

pause
