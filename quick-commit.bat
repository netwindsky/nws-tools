@echo off
chcp 65001 >nul
title NWS Tools - 快速提交

echo.
echo ========================================
echo   NWS Tools - 快速提交到 GitHub
echo ========================================
echo.

:: 检查是否在正确的目录
if not exist "manifest.json" (
    echo [错误] 请在正确的项目目录下运行此脚本
    pause
    exit /b 1
)

echo [1/4] 添加所有更改...
git add -A

echo [2/4] 提交更改...
git commit -m "chore: 自动提交更新"

echo [3/4] 拉取最新代码...
git pull origin main

echo [4/4] 推送到 GitHub...
git push origin main

echo.
echo ========================================
echo   提交完成！
echo ========================================
echo.

timeout /t 3
pause
