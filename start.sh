#!/bin/bash

# Capstone Project Management System - Startup Script

echo "=========================================="
echo "Capstone Project Management System"
echo "Team: CopiumCoders"
echo "=========================================="
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is not installed"
    exit 1
fi

# Check if dependencies are installed
echo "Checking dependencies..."
if ! python3 -c "import flask" 2>/dev/null; then
    echo "Installing dependencies..."
    pip install -r requirements.txt --break-system-packages
fi

# Start backend server in background
echo "Starting backend server on http://localhost:5000..."
cd backend
python3 app.py &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 2

# Start frontend server
echo "Starting frontend server on http://localhost:8000..."
cd frontend
python3 -m http.server 8000 &
FRONTEND_PID=$!
cd ..

echo ""
echo "=========================================="
echo "Application is running!"
echo "=========================================="
echo "Backend:  http://localhost:5000"
echo "Frontend: http://localhost:8000"
echo ""
echo "Open your browser to: http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop all servers"
echo "=========================================="

# Trap Ctrl+C and cleanup
trap "echo ''; echo 'Shutting down servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT

# Wait for user to stop
wait
