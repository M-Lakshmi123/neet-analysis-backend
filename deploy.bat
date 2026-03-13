@echo off
setlocal

echo.
echo ===========================================
echo    NEET Analysis Deployment Script
echo ===========================================
echo.

:: 1. Get Commit Message
set /p msg="Enter commit message (or press Enter for default): "
if "%msg%"=="" set msg="Deployment Update: %date% %time%"

echo.
echo === 1. Pulling latest changes ===
git pull origin master --rebase

echo.
echo === 2. Adding files ===
git add .

echo.
echo === 3. Committing changes ===
git commit -m "%msg%"

echo.
echo === 4. Pushing to GitHub ===
git push origin master

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Git push failed. Please check your connection or token.
    pause
    exit /b %errorlevel%
)

echo.
echo === 5. Triggering Render Deployment ===
:: Using PowerShell Invoke-RestMethod as it is more reliable on Windows than curl
powershell -Command "try { $res = Invoke-RestMethod -Uri 'https://api.render.com/deploy/srv-d5u3r3nfte5s7390fou0?key=a_9tubU-WcI' -Method Post; Write-Host 'Deployment Triggered Successfully!' } catch { Write-Host 'Error triggering deployment: ' $_.Exception.Message; exit 1 }"

if %errorlevel% neq 0 (
    echo.
    echo [WARNING] Render trigger failed, but code was pushed to GitHub.
    echo Check your Render dashboard manually.
)

echo.
echo ===========================================
echo    SUCCESS! Deployment started on Render.
echo ===========================================
echo.
pause
