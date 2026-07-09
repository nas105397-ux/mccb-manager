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
set /p BOOTSTRAP_LITE=Run first-time Lite setup on Raspberry Pi? ^(y/N^):
set /p JAPANESE_INPUT=Install Japanese input for kiosk? ^(y/N^):
set /p KEY_PATH=SSH key path ^(blank: auto/default^):

set "KIOSK_ARG="
if /i "%START_KIOSK%"=="y" set "KIOSK_ARG=-StartKiosk"
if /i "%START_KIOSK%"=="yes" set "KIOSK_ARG=-StartKiosk"

set "BOOTSTRAP_ARG="
if /i "%BOOTSTRAP_LITE%"=="y" set "BOOTSTRAP_ARG=-BootstrapLite"
if /i "%BOOTSTRAP_LITE%"=="yes" set "BOOTSTRAP_ARG=-BootstrapLite"

set "JAPANESE_INPUT_ARG="
if /i "%JAPANESE_INPUT%"=="y" set "JAPANESE_INPUT_ARG=-InstallJapaneseInput"
if /i "%JAPANESE_INPUT%"=="yes" set "JAPANESE_INPUT_ARG=-InstallJapaneseInput"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%deploy-over-ssh.ps1" -Target "%TARGET%" -Port %PORT% -AppDir "%APP_DIR%" %KIOSK_ARG% %BOOTSTRAP_ARG% %JAPANESE_INPUT_ARG% -KeyPath "%KEY_PATH%"

echo.
if errorlevel 1 (
  echo Deploy failed.
) else (
  echo Deploy finished.
)
pause
