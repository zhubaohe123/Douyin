@echo off
title Douyin Comment Collector - One-Click Startup

echo =====================================================================
echo             Douyin Comment Collector - One-Click Startup
echo =====================================================================
echo.
echo [System] Starting background services. Please keep popup windows open...
echo.

REM 1. Start FastAPI Playwright search API (Port 8000)
echo [1/3] Starting [FastAPI Playwright Search API] (Port: 8000)...
if exist "%~dp0..\Douyin-api\main.py" (
    start "1. Douyin Search API (Port 8000)" /d "%~dp0..\Douyin-api" cmd /k "python main.py"
) else (
    echo [Warning] Cannot find main.py in %~dp0..\Douyin-api, trying absolute path...
    if exist "d:\daima\Douyin-api\main.py" (
        start "1. Douyin Search API (Port 8000)" /d "d:\daima\Douyin-api" cmd /k "python main.py"
    ) else (
        echo [Error] Douyin-api folder not found!
    )
)
timeout /t 3 >nul

REM 2. Start Express database sync backend (Port 3001)
echo [2/3] Starting [Express Database Backend] (Port: 3001)...
if exist "%~dp0server\index.js" (
    start "2. DB Sync Server (Port 3001)" /d "%~dp0server" cmd /k "npm run dev"
) else (
    echo [Warning] Cannot find index.js in %~dp0server, trying absolute path...
    if exist "d:\daima\Douyin\server\index.js" (
        start "2. DB Sync Server (Port 3001)" /d "d:\daima\Douyin\server" cmd /k "npm run dev"
    ) else (
        echo [Error] Express server folder not found!
    )
)
timeout /t 2 >nul

REM 3. Start React + Vite frontend console
echo [3/3] Starting [Vite Frontend]...
start "3. Vite Frontend Console" /d "%~dp0" cmd /k "npm run dev"
timeout /t 3 >nul

echo.
echo =====================================================================
echo.
echo  🎉 All backend services launched!
echo.
echo  - FastAPI Search API: http://localhost:8000
echo  - Express DB Server : http://localhost:3001
echo  - Vite React App    : http://localhost:5173
echo.
echo  Opening browser to Vite frontend...
echo.
echo =====================================================================

start http://localhost:5173

echo.
echo Press any key to exit this console (background services will remain running)...
pause >nul
