@echo off
TITLE NEET ANALYSIS - AUTOMATIC ERROR COUNT REPORT UPLOAD
COLOR 0B

echo ========================================================
echo   NEET ANALYSIS: AUTOMATIC ERROR COUNT REPORT UPLOAD
echo ========================================================
echo.

echo [STEP 1/2] Verifying Year, Stream ^& Test Folders in ERP_Count_Reports...
node server\create_error_count_folders.js
echo.

echo [STEP 2/2] Scanning all folders ^& uploading Excel files automatically...
node server\extract_erp_counts_only.js --auto

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [!] ERROR: Extraction failed. Please check logs.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ========================================================
echo   SUCCESS: ALL ERROR COUNT REPORTS READY IN DATABASE
echo ========================================================
echo.
pause
