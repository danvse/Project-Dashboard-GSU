@echo off
REM Capstone Project Management System - Startup Script for Windows

echo ==========================================
echo Capstone Project Management System
echo Team: CopiumCoders
echo ==========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python is not installed or not in PATH
    pause
    exit /b 1
)

REM Install dependencies if needed
echo Checking dependencies...
python -c "import flask" >nul 2>&1
if errorlevel 1 (
    echo Installing dependencies...
    pip install -r requirements.txt
)

REM Start backend server
echo Starting backend server on http://localhost:5000...
start /B python backend\app.py

REM Wait for backend to start
timeout /t 2 /nobreak >nul

REM Start frontend server
echo Starting frontend server on http://localhost:8000...
cd frontend
start /B python -m http.server 8000
cd ..

echo.
echo ==========================================
echo Application is running!
echo ==========================================
echo Backend:  http://localhost:5000
echo Frontend: http://localhost:8000
echo.
echo Open your browser to: http://localhost:8000
echo.
echo Press any key to stop all servers...
echo ==========================================

pause >nul

REM Kill Python processes (backend and frontend)
taskkill /F /IM python.exe /FI "WINDOWTITLE eq *app.py*" >nul 2>&1
taskkill /F /IM python.exe /FI "WINDOWTITLE eq *http.server*" >nul 2>&1

echo Servers stopped.
pause
