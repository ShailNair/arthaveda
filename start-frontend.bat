@echo off
echo ============================================
echo   Lottery Advisor — Starting Frontend
echo ============================================
cd /d "%~dp0frontend"
echo Starting Next.js on http://localhost:3000
echo.
npm run dev
pause
