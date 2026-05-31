@echo off
:: 设置字符集为 UTF-8，防止中文乱码
chcp 65001 >nul
title 抖音评论采集分析平台 - 一键启动

echo =====================================================================
echo             抖音评论采集分析平台 - 一键启动脚本
echo =====================================================================
echo.
echo [系统检测] 正在启动各项后台服务，请保持弹出的 CMD 窗口不要关闭...
echo.

REM 1. 启动本地 FastAPI + Playwright 搜索接口 (端口 8000)
echo [1/3] 正在后台启动 [FastAPI Playwright 搜索 API] (服务端口: 8000)...
if exist "%~dp0..\Douyin-api\main.py" (
    start "1. 抖音搜索 API 服务 (Port 8000)" /d "%~dp0..\Douyin-api" cmd /k "python main.py"
) else (
    echo [警告] 未在 %~dp0..\Douyin-api 发现 main.py，尝试使用绝对路径 d:\daima\Douyin-api 启动...
    if exist "d:\daima\Douyin-api\main.py" (
        start "1. 抖音搜索 API 服务 (Port 8000)" /d "d:\daima\Douyin-api" cmd /k "python main.py"
    ) else (
        echo [错误] 找不到 抖音搜索 API 服务，请确认 Douyin-api 文件夹位置！
    )
)
timeout /t 3 >nul

REM 2. 启动 Express 数据库中转后台服务 (端口 3001)
echo [2/3] 正在后台启动 [Express 数据库中转后台] (服务端口: 3001)...
if exist "%~dp0server\index.js" (
    start "2. 数据库中转服务 (Port 3001)" /d "%~dp0server" cmd /k "npm run dev"
) else (
    echo [警告] 未在 %~dp0server 发现 index.js，尝试使用绝对路径 d:\daima\Douyin\server 启动...
    if exist "d:\daima\Douyin\server\index.js" (
        start "2. 数据库中转服务 (Port 3001)" /d "d:\daima\Douyin\server" cmd /k "npm run dev"
    ) else (
        echo [错误] 找不到 数据库中转服务，请确认 server 文件夹位置！
    )
)
timeout /t 2 >nul

REM 3. 启动 React + Vite 前端控制台 (端口 5173)
echo [3/3] 正在后台启动 [Vite 前端控制台]...
start "3. Vite 前端界面" /d "%~dp0" cmd /k "npm run dev"
timeout /t 3 >nul

echo.
echo =====================================================================
echo.
echo  🎉 所有服务启动指令已发出！
echo.
echo  🌐 FastAPI 搜索 API 接口端: http://localhost:8000
echo  🗃️ Express 数据库中转后台 : http://localhost:3001
echo  💻 网页前端系统控制台接口 : http://localhost:5173
echo.
echo  正在自动为您在浏览器中打开前端界面...
echo.
echo =====================================================================

REM 自动在默认浏览器中打开前端页面
start http://localhost:5173

echo.
echo 按任意键退出本一键启动控制台 (后台服务仍会继续运行)...
pause >nul
