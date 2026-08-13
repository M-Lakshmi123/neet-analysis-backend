@echo off
TITLE NEET Analysis Auto-Deployer
COLOR 0B
CLS

:: Auto-detect Git path if not in environment PATH
where git >nul 2>nul
if %errorlevel% neq 0 (
    if exist "C:\Program Files\Git\cmd" set "PATH=%PATH%;C:\Program Files\Git\cmd"
    if exist "C:\Program Files (x86)\Git\cmd" set "PATH=%PATH%;C:\Program Files (x86)\Git\cmd"
    if exist "%LOCALAPPDATA%\Programs\Git\cmd" set "PATH=%PATH%;%LOCALAPPDATA%\Programs\Git\cmd"
)

echo ========================================================
echo        NEET ANALYSIS - AUTOMATIC ONE-CLICK DEPLOYER
echo ========================================================
echo.

:: 1. Auto-generate Commit Message (No typing required)
if "%~1"=="" (
    set "msg=Auto-deploy updates: %date% %time%"
) else (
    set "msg=%~1"
)

echo [Info] Commit Message: "%msg%"
echo.

:: 2. Build Frontend (Client)
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
echo [2/3] Pushing to GitHub (Render will auto-deploy)...
git add .
git commit -m "%msg%"
git push
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Git push failed. Please check your connection.
    pause
    exit /b
)

:: 4. Render Manual Deploy Hooks
echo.
echo [3/3] Triggering Render Manual Deploy Hooks (Multi-Account Failover)...
curl -X POST "https://api.render.com/deploy/srv-d5u3r3nfte5s7390fou0?key=a_9tubU-WcI"
curl -X POST "https://api.render.com/deploy/srv-d6uctgn5gffc739l5emg?key=BPEwOP8wjAc"
echo.

echo.
echo ========================================================
echo        DEPLOYMENT PROCESS COMPLETE!
echo ========================================================
echo Your changes are pushed and being deployed automatically by Render.
echo.
timeout /t 5
