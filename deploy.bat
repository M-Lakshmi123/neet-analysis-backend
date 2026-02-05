@echo off
set /p msg="Enter commit message: "
if "%msg%"=="" set msg="Updated PDF logic and layout"

echo.
echo === Adding files ===
git add .

echo.
echo === Committing changes ===
git commit -m "%msg%"

echo.
echo === Pushing to GitHub (master) ===
git push origin master

echo.
echo === Done! Render will start deploying automatically. ===
pause
