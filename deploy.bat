@echo off
set /p msg="Enter commit message: "
if "%msg%"=="" set msg="Fixed PDF layout and logic"

echo.
echo === Adding files ===
git add .

echo.
echo === Committing changes ===
git commit -m "%msg%"

echo.
echo === Pushing to GitHub ===
git push origin master

echo.
echo === Triggering Render Deployment ===
curl -X POST "https://api.render.com/deploy/srv-d5u3r3nfte5s7390fou0?key=a_9tubU-WcI"

echo.
echo.
echo === Success! Deployment started on Render. ===
pause
