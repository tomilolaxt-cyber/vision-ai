@echo off
title Vision AI
:: Request admin privileges automatically
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Requesting administrator privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo.
echo  ================================
echo   VISION AI - Starting...
echo   Running as Administrator
echo  ================================
echo.
cd /d "%~dp0"
start "" "http://localhost:5000"
python server.py
pause
