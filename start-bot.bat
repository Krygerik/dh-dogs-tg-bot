@echo off
chcp 65001 >nul
title Dread Hunger Server Bot

echo ============================================
echo    Dread Hunger Server Bot
echo ============================================
echo.

cd /d "%~dp0"

:: Check if node_modules exists
if not exist "node_modules\" (
    echo [INFO] Установка зависимостей...
    call npm install
    echo.
)

:: Check if dist folder exists
if not exist "dist\" (
    echo [INFO] Сборка проекта...
    call npm run build
    echo.
)

:: Check if .env file exists
if not exist ".env" (
    echo [ERROR] Файл .env не найден!
    echo [INFO] Скопируйте env.example в .env и укажите BOT_TOKEN
    pause
    exit /b 1
)

echo [INFO] Запуск бота...
echo.
node dist/index.js

pause

