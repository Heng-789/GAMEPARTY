@echo off
echo 🚀 Starting all 3 dev servers...
echo.

echo Starting HENG36 dev server on port 5173...
start "HENG36 Dev Server" cmd /k "npm run dev:heng36"

timeout /t 2 /nobreak >nul

echo Starting MAX56 dev server on port 5174...
start "MAX56 Dev Server" cmd /k "npm run dev:max56"

timeout /t 2 /nobreak >nul

echo Starting JEED24 dev server on port 5175...
start "JEED24 Dev Server" cmd /k "npm run dev:jeed24"

timeout /t 3 /nobreak >nul

echo.
echo ✅ All dev servers started!
echo.
echo 📋 Dev Server URLs:
echo    - HENG36: http://localhost:5173
echo    - MAX56:  http://localhost:5174
echo    - JEED24: http://localhost:5175
echo.
echo 💡 Each server runs in a separate command window
echo    Close the windows to stop the servers
echo.
pause

