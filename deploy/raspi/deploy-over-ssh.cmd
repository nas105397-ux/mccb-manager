@echo off
setlocal

set "SCRIPT_DIR=%~dp0"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%deploy-over-ssh.ps1"

echo.
if errorlevel 1 (
  echo Deploy failed.
) else (
  echo Deploy finished.
)
pause
