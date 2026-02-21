@echo off
title Lackadaisical AI Chat - Startup Script
color 0A

echo.
echo  ██╗      █████╗  ██████╗██╗  ██╗ █████╗ ██████╗  █████╗ ██╗███████╗██╗ ██████╗ █████╗ ██╗     
echo  ██║     ██╔══██╗██╔════╝██║ ██╔╝██╔══██╗██╔══██╗██╔══██╗██║██╔════╝██║██╔════╝██╔══██╗██║     
echo  ██║     ███████║██║     █████╔╝ ███████║██║  ██║███████║██║███████╗██║██║     ███████║██║     
echo  ██║     ██╔══██║██║     ██╔═██╗ ██╔══██║██║  ██║██╔══██║██║╚════██║██║██║     ██╔══██║██║     
echo  ███████╗██║  ██║╚██████╗██║  ██╗██║  ██║██████╔╝██║  ██║██║███████║██║╚██████╗██║  ██║███████╗
echo  ╚══════╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═╝  ╚═╝╚═╝╚══════╝╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝
echo.
echo                              AI CHAT - Your Personal Companion
echo                              By Lackadaisical Security 2025
echo                              https://lackadaisical-security.com
echo.
echo  ═══════════════════════════════════════════════════════════════════════════════════════════════
echo.

:: Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ERROR: Node.js is not installed or not in PATH!
    echo.
    echo 📥 Please install Node.js from: https://nodejs.org/
    echo    Recommended version: 18.x or higher
    echo.
    pause
    exit /b 1
)

:: Check if npm is available
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ERROR: npm is not available!
    echo.
    echo 📥 Please ensure npm is installed with Node.js
    echo.
    pause
    exit /b 1
)

:: Check if Ollama is running
echo 🔍 Checking Ollama status...
curl -s http://localhost:11434/api/tags >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ⚠️  WARNING: Ollama is not running or not accessible on localhost:11434
    echo.
    echo 🚀 To start Ollama manually:
    echo    1. Open Command Prompt as Administrator
    echo    2. Run: ollama serve
    echo    3. In another terminal: ollama pull lackadaisical-assistant:latest
    echo.
    echo 📋 Or download Ollama from: https://ollama.ai/
    echo.
    set /p continue="Continue without Ollama? (y/n): "
    if /i "%continue%" neq "y" (
        echo.
        echo 🛑 Startup cancelled. Please start Ollama first.
        pause
        exit /b 1
    )
    echo.
    echo ⏭️  Continuing without Ollama (AI features will be limited)...
)

echo.
echo 🚀 Starting Lackadaisical AI Chat...
echo.

:: Install dependencies if node_modules doesn't exist
echo 📦 Checking dependencies...

if not exist "backend\node_modules" (
    echo 📥 Installing backend dependencies...
    cd backend
    call npm install
    if %errorlevel% neq 0 (
        echo ❌ Failed to install backend dependencies!
        pause
        exit /b 1
    )
    cd ..
)

if not exist "frontend\node_modules" (
    echo 📥 Installing frontend dependencies...
    cd frontend
    call npm install
    if %errorlevel% neq 0 (
        echo ❌ Failed to install frontend dependencies!
        pause
        exit /b 1
    )
    cd ..
)

echo.
echo ✅ Dependencies ready!
echo.
echo 🔄 Starting services...
echo.

:: Create a new window for the backend
echo 🖥️  Starting Backend Server (Port 3001)...
start "Lackadaisical AI - Backend" cmd /k "cd /d \"%~dp0backend\" && npm start"

:: Wait a moment for backend to start
timeout /t 3 /nobreak >nul

:: Create a new window for the frontend
echo 🌐 Starting Frontend Development Server...
start "Lackadaisical AI - Frontend" cmd /k "cd /d \"%~dp0frontend\" && npm run dev"

:: Wait a moment for frontend to start
echo.
echo ⏳ Waiting for services to initialize...
timeout /t 5 /nobreak >nul

echo.
echo 🎉 Lackadaisical AI Chat is starting up!
echo.
echo 📍 Frontend: http://localhost:3000 (or http://localhost:3002)
echo 📍 Backend API: http://localhost:3001
echo 📍 Ollama: http://localhost:11434 (if running)
echo.
echo 🤖 Companion Commands Available:
echo    /help     - View all commands
echo    /checkin  - Daily emotional check-in
echo    /journal  - Reflective journaling
echo    /reflect  - Guided reflection
echo    /memory   - View conversation history
echo    /mood     - Track your mood
echo    /gratitude- Share gratitude
echo    /goals    - Set personal goals
echo.
echo 💡 TIP: Use companion commands for emotional support and journaling!
echo.

:: Check if services are responding
echo 🔍 Checking service health...
timeout /t 3 /nobreak >nul

curl -s http://localhost:3001/api/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Backend is healthy and responding!
) else (
    echo ⚠️  Backend might still be starting...
)

echo.
echo 🌟 Setup complete! Your AI companion is ready.
echo 📖 Check README.md for usage instructions
echo 🐛 Report issues at: https://github.com/yourusername/lackadaisical-ai-chat
echo.
echo Press any key to open the application in your browser...
pause >nul

:: Open the application in default browser
start http://localhost:3000

echo.
echo 🎯 Application launched! Check your browser.
echo 🔧 Keep this window open to monitor the startup process.
echo.
echo 📝 To stop the application:
echo    - Close the Backend and Frontend terminal windows
echo    - Or press Ctrl+C in each terminal
echo.
pause
