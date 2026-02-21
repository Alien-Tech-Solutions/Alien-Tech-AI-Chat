@echo off
title Lackadaisical AI Chat - Alpha Test Startup
color 0A

echo.
echo  ===============================================
echo   🚀 Lackadaisical AI Chat - Alpha Test 🚀
echo   Starting Companion AI System...
echo   Build Date: July 27, 2025
echo  ===============================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: Check if npm is installed
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ ERROR: npm is not installed or not in PATH
    echo Please install npm (usually comes with Node.js)
    pause
    exit /b 1
)

:: Check if we're in the right directory
if not exist "package.json" (
    echo ❌ ERROR: package.json not found
    echo Please run this script from the Lackadaisical AI Chat directory
    pause
    exit /b 1
)

:: Check if Ollama is running
echo 🔍 Checking Ollama connection...
curl -s http://localhost:11434/api/tags >nul 2>nul
if %errorlevel% neq 0 (
    echo ⚠️  WARNING: Ollama doesn't seem to be running on localhost:11434
    echo Please make sure Ollama is installed and running.
    echo You can download it from: https://ollama.ai/
    echo.
    echo Starting anyway - you can connect to external AI providers...
    timeout /t 3 >nul
)

echo.
echo 📦 Installing dependencies...
echo.

:: Install root dependencies
npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install root dependencies
    pause
    exit /b 1
)

:: Install backend dependencies
echo 🔧 Installing backend dependencies...
cd backend
npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install backend dependencies
    pause
    exit /b 1
)
cd ..

:: Install frontend dependencies
echo 🎨 Installing frontend dependencies...
cd frontend
npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install frontend dependencies
    pause
    exit /b 1
)
cd ..

echo.
echo ✅ Dependencies installed successfully!
echo.
echo 🚀 Starting Lackadaisical AI Chat servers...
echo.
echo   📍 Backend will start on: http://localhost:3001
echo   📍 Frontend will start on: http://localhost:3000
echo.
echo ⚡ Available Companion Commands:
echo   /help      - Show all companion commands
echo   /checkin   - Daily emotional check-in
echo   /journal   - Reflective journaling
echo   /reflect   - Guided reflection
echo   /memory    - View conversation memories
echo   /mood      - Track your mood
echo   /gratitude - Practice gratitude
echo   /goals     - Set and track goals
echo.

:: Start backend in new window
echo 🔥 Starting backend server...
start "Lackadaisical AI Backend" cmd /k "cd /d %~dp0backend && npm run dev"

:: Wait a moment for backend to start
timeout /t 5 >nul

:: Start frontend in new window
echo 🎨 Starting frontend server...
start "Lackadaisical AI Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ✅ Both servers are starting!
echo.
echo 🌐 Your AI companion will be available at:
echo    👉 http://localhost:3000
echo.
echo 📝 Alpha Test Notes:
echo    • All 8 companion commands are working
echo    • Real-time streaming with Ollama
echo    • Persistent memory and personality
echo    • SQLite database for local storage
echo.
echo 🛑 To stop the servers, close the terminal windows or press Ctrl+C
echo.
echo 💤 Have a great night! The AI will remember our conversation tomorrow 😊
echo.

:: Wait for user acknowledgment
echo Press any key to open the web interface...
pause >nul

:: Open the web interface
start http://localhost:3000

echo.
echo 🎉 Lackadaisical AI Chat Alpha is now running!
echo    Frontend: http://localhost:3000
echo    Backend:  http://localhost:3001
echo.
echo Happy chatting with your new AI companion! 🤖💙
