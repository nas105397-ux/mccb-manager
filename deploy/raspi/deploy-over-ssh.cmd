@echo off
setlocal

set "SCRIPT_DIR=%~dp0"

echo MCCB Manager Raspberry Pi deploy
echo.
set /p TARGET=Target user and host ^(example: pi@192.168.1.50^): 
if "%TARGET%"=="" (
  echo Target is required.
  pause
  exit /b 1
)

set /p PORT=SSH port ^(default: 22^): 
if "%PORT%"=="" set "PORT=22"

set /p APP_DIR=App directory ^(default: $HOME/mccb-manager^): 
if "%APP_DIR%"=="" set "APP_DIR=$HOME/mccb-manager"

set /p START_KIOSK=Start kiosk after deploy? ^(y/N^): 

set "KIOSK_ARG="
if /i "%START_KIOSK%"=="y" set "KIOSK_ARG=-StartKiosk"
if /i "%START_KIOSK%"=="yes" set "KIOSK_ARG=-StartKiosk"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%deploy-over-ssh.ps1" -Target "%TARGET%" -Port %PORT% -AppDir "%APP_DIR%" %KIOSK_ARG%

echo.
if errorlevel 1 (
  echo Deploy failed.
) else (
  echo Deploy finished.
)
pause
