@echo off
echo ========================================================
echo   NEET RESULT EXCEL EXTRACTOR & UPLOADER
echo ========================================================
echo.
cd /d "%~dp0"
node server/extract_neet_results.js
echo.
echo ========================================================
echo   Process Finished. Check log above for details.
echo ========================================================
pause
