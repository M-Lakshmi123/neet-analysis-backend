@echo off
TITLE NEET Analysis Super-Deployer
COLOR 0B
CLS

echo ========================================================
echo        NEET ANALYSIS - ONE-CLICK DEPLOYER
echo ========================================================
echo.

:: 1. Ask for Commit Message
set /p msg="Enter your commit message (or press enter for 'Auto-deploy'): "
if "%msg%"=="" set msg="Auto-deploy: %date% %time%"

:: 2. Build Frontend (Client)
echo.
echo [1/3] Building Frontend (Client)...
cd client
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Client build failed. Deployment aborted.
    pause
    exit /b
)
cd ..

:: 3. Git Push (Render handles auto-deploy from here)
echo.
echo [2/3] pushing to GitHub (Render will auto-deploy)...
git add .
git commit -m "%msg%"
git push
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Git push failed. Please check your connection.
    pause
    exit /b
)

:: 4. Optional Firebase Deploy
echo.
set /p fire="[3/3] Also deploy to Firebase Hosting? (y/n): "
if /i "%fire%"=="y" (
    echo.
    echo Deploying to Firebase...
    cd client
    call firebase deploy --only hosting
    cd ..
)

:: 5. Render Manual Deploy Hook
echo.
echo [4/4] Triggering Render Manual Deploy Hook...
curl -X POST "https://api.render.com/deploy/srv-d5u3r3nfte5s7390fou0?key=a_9tubU-WcI"
echo.

echo.
echo ========================================================
echo        DEPLOYMENT PROCESS COMPLETE!
echo ========================================================
echo Your changes are now being processed by Render.
echo.
pause
