@echo off
echo ============================================
echo   Lottery Advisor — Starting Backend
echo ============================================
cd /d "%~dp0backend"
echo Starting FastAPI server on http://localhost:8000
echo API Docs: http://localhost:8000/docs
echo.
python main.py
pause
