@echo off
setlocal

set "SCRIPT_DIR=%~dp0"

echo MCCB Manager Raspberry Pi SSH key setup
echo.
set /p TARGET=Target user and host ^(example: pi@192.168.1.50^):
if "%TARGET%"=="" (
  echo Target is required.
  pause
  exit /b 1
)

set /p PORT=SSH port ^(default: 22^):
if "%PORT%"=="" set "PORT=22"

set /p KEY_PATH=SSH key path ^(default: %%USERPROFILE%%\.ssh\mccb_manager_ed25519^):
if "%KEY_PATH%"=="" set "KEY_PATH=%USERPROFILE%\.ssh\mccb_manager_ed25519"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%setup-ssh-key.ps1" -Target "%TARGET%" -Port %PORT% -KeyPath "%KEY_PATH%"

echo.
if errorlevel 1 (
  echo SSH key setup failed.
) else (
  echo SSH key setup finished.
)
pause
