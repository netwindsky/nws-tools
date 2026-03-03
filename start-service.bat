@echo off
chcp 65001 >nul
title 启动本地 API 服务 - 端口 38520

echo.
echo ========================================
echo   启动本地 API 服务
echo ========================================
echo.

echo [启动中] 正在启动本地 API 服务...
echo.

:: 启动服务（根据你的实际需求修改端口和模型）
:: 方式 1: 如果是 Python 服务
:: python -m http.server 38520

:: 方式 2: 如果是 Node.js 服务
:: node server.js

:: 方式 3: 如果是 Ollama
ollama serve

echo.
echo ========================================
echo   服务已启动！
echo ========================================
echo.
echo API 地址：http://localhost:38520/v1/chat/completions
echo.
echo 按 Ctrl+C 停止服务
echo.

pause
