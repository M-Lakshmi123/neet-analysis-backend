@echo off
TITLE NEET ANALYSIS - ERP REPORT GENERATION PROCESS
COLOR 0A

echo ========================================================
echo   NEET ANALYSIS: ERP REPORT GENERATION WORKFLOW
echo ========================================================
echo.
set /p TEST_NAME="Enter Test Name (e.g., NSGT-02): "
set /p TEST_TYPE="Enter Test Type (e.g., NSGT): "
echo.

:: Image Upload & URL Mapping (Now reusing cache to save time)
echo.

:: Step 1: Image Upload & URL Mapping
echo [STEP 1/2] Uploading Question Images to ImgBB...
echo Testing for: %TEST_NAME% in %TEST_TYPE%
echo.
node server\upload_to_imgbb_neet.js "%TEST_NAME%" "%TEST_TYPE%"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [!] ERROR: ImgBB Upload failed. 
    echo Please check your internet connection or credentials.
    pause
    exit /b %ERRORLEVEL%
)
echo.
echo [+] STEP 1 COMPLETE: URL Mapping generated successfully.
echo.

:: Step 2: Data Extraction & Database Sync
echo [STEP 2/2] Extracting Marks, Errors, and Metadata...
echo Syncing with Zero Report and Keys for %TEST_NAME%...
echo.

node server\extract_erp_neet.js "%TEST_NAME%" "%TEST_TYPE%"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [!] ERROR: ERP Extraction failed.
    echo Check if the Excel files are open or if TiDB is reachable.
    pause
    exit /b %ERRORLEVEL%
)
echo.

echo ========================================================
echo   SUCCESS: ERP REPORT READY IN TIDB
echo ========================================================
echo.
echo Process Summary:
echo 1. Images Uploaded ^& Mapped
echo 2. Results ^& National Wide Error Analysis Synced
echo.
pause
