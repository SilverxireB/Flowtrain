@echo off
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js bulunamadi.
  echo   https://nodejs.org adresinden LTS surumunu kurun,
  echo   sonra bu dosyayi tekrar calistirin.
  echo.
  pause
  exit /b 1
)

node scripts/kur.mjs

echo.
pause
