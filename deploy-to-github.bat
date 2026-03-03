@echo off
chcp 65001 >nul
title NWS Tools - 一键部署到 GitHub

echo.
echo ========================================
echo   NWS Tools - 一键部署到 GitHub
echo ========================================
echo.

:: 检查是否在正确的目录
if not exist "manifest.json" (
    echo [错误] 请在正确的项目目录下运行此脚本
    echo 当前目录：%CD%
    pause
    exit /b 1
)

echo [1/4] 检查 Git 状态...
git status
if errorlevel 1 (
    echo [错误] Git 状态检查失败
    pause
    exit /b 1
)

echo.
echo [2/4] 添加所有更改到暂存区...
git add -A
if errorlevel 1 (
    echo [错误] 添加文件失败
    pause
    exit /b 1
)
echo [成功] 文件已添加到暂存区

echo.
echo [3/4] 提交更改...
set /p commit_msg="请输入提交信息 (直接回车使用默认信息): "
if "%commit_msg%"=="" (
    set commit_msg=chore: 更新项目配置
)
git commit -m "%commit_msg%"
if errorlevel 1 (
    echo [提示] 没有需要提交的文件或提交失败
    echo 继续执行推送操作...
)

echo.
echo [4/4] 推送到 GitHub...
git push origin main
if errorlevel 1 (
    echo [错误] 推送失败
    pause
    exit /b 1
)

echo.
echo ========================================
echo   部署完成！
echo ========================================
echo.
echo 仓库地址：https://github.com/netwindsky/nws-tools
echo.

pause
