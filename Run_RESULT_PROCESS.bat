@echo off
echo ========================================================
echo   NEET RESULT EXCEL EXTRACTOR & UPLOADER
echo ========================================================
echo.

set /p TEST_TYPE="Enter Test Type (e.g. NST, MT, WT): "
set /p TEST_NAME="Enter Test Name (e.g. NST-01, MT-07): "

echo.
cd /d "%~dp0"
node server/extract_neet_results.js "%TEST_TYPE%" "%TEST_NAME%"
echo.
echo ========================================================
echo   Process Finished. Check log above for details.
echo ========================================================
pause

