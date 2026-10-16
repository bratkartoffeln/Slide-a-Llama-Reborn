@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Bitte Node.js 24 installieren.
  pause
  exit /b 1
)
if not exist node_modules (
  call npm ci
  if errorlevel 1 exit /b 1
)
echo Slide-a-Lama: Nach dem Start http://localhost:5173 oeffnen.
call npm run dev
