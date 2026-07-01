param(
  [Parameter(Mandatory = $true)]
  [string]$Target,

  [string]$AppDir = '$HOME/mccb-manager',

  [int]$Port = 22,

  [switch]$SkipBuild,

  [switch]$StartKiosk
)

$ErrorActionPreference = 'Stop'

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) "mccb-manager-deploy-$([guid]::NewGuid())"
$StageDir = Join-Path $TempRoot 'package'
$ZipPath = Join-Path $TempRoot 'mccb-manager-deploy.zip'
$RemoteScriptPath = Join-Path $TempRoot 'mccb-manager-remote-deploy.sh'
$RemoteZip = '/tmp/mccb-manager-deploy.zip'
$RemoteScriptFile = '/tmp/mccb-manager-remote-deploy.sh'
$StartKioskValue = if ($StartKiosk.IsPresent) { '1' } else { '0' }
$SshOptions = @(
  '-o', 'ConnectTimeout=20',
  '-o', 'ServerAliveInterval=10',
  '-o', 'ServerAliveCountMax=3'
)

function Assert-NativeCommandSucceeded {
  param([string]$Action)

  if ($LASTEXITCODE -ne 0) {
    throw "$Action failed with exit code $LASTEXITCODE."
  }
}

function Invoke-NativeCommandWithRetry {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Action,

    [Parameter(Mandatory = $true)]
    [string]$Command,

    [Parameter(Mandatory = $true)]
    [string[]]$Arguments,

    [int]$MaxAttempts = 3,

    [int]$RetryDelaySeconds = 5
  )

  for ($Attempt = 1; $Attempt -le $MaxAttempts; $Attempt++) {
    & $Command @Arguments
    if ($LASTEXITCODE -eq 0) {
      return
    }

    if ($Attempt -lt $MaxAttempts) {
      Write-Warning "$Action failed with exit code $LASTEXITCODE. Retrying in $RetryDelaySeconds seconds ($Attempt/$MaxAttempts)..."
      Start-Sleep -Seconds $RetryDelaySeconds
    }
  }

  throw "$Action failed with exit code $LASTEXITCODE."
}

function Copy-RepoItem {
  param([string]$Path)

  $Source = Join-Path $RepoRoot $Path
  $Destination = Join-Path $StageDir $Path
  $DestinationParent = Split-Path $Destination -Parent

  New-Item -ItemType Directory -Force -Path $DestinationParent | Out-Null
  Copy-Item -Path $Source -Destination $Destination -Recurse -Force
}

function Convert-StagedUnixLineEndings {
  $Patterns = @('*.sh', '*.service', '*.conf')
  foreach ($Pattern in $Patterns) {
    Get-ChildItem -Path $StageDir -Filter $Pattern -Recurse -File | ForEach-Object {
      $Content = [System.IO.File]::ReadAllText($_.FullName)
      $Content = $Content -replace "`r`n", "`n"
      $Content = $Content -replace "`r", "`n"
      [System.IO.File]::WriteAllText(
        $_.FullName,
        $Content,
        [System.Text.UTF8Encoding]::new($false)
      )
    }
  }
}

function Compress-StagedPackage {
  if (Test-Path $ZipPath) {
    Remove-Item -LiteralPath $ZipPath -Force
  }

  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem

  $Zip = [System.IO.Compression.ZipFile]::Open(
    $ZipPath,
    [System.IO.Compression.ZipArchiveMode]::Create
  )

  try {
    $BasePath = [System.IO.Path]::GetFullPath($StageDir).TrimEnd('\', '/')

    Get-ChildItem -LiteralPath $StageDir -Recurse -File -Force | ForEach-Object {
      $FullPath = [System.IO.Path]::GetFullPath($_.FullName)
      $RelativePath = $FullPath.Substring($BasePath.Length).TrimStart('\', '/')
      $EntryName = $RelativePath -replace '\\', '/'

      [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
        $Zip,
        $FullPath,
        $EntryName,
        [System.IO.Compression.CompressionLevel]::Optimal
      ) | Out-Null
    }
  }
  finally {
    $Zip.Dispose()
  }
}

try {
  Set-Location $RepoRoot

  if (-not $SkipBuild) {
    if (-not (Test-Path (Join-Path $RepoRoot 'node_modules'))) {
      npm ci
    }
    npm run build
  }

  if (-not (Test-Path (Join-Path $RepoRoot 'dist'))) {
    throw 'dist was not found. Run without -SkipBuild first, or run npm run build.'
  }

  New-Item -ItemType Directory -Force -Path $StageDir | Out-Null

  @(
    'package.json',
    'package-lock.json',
    'node_modules',
    'server.js',
    'dbStore.js',
    'src/shared',
    'dist',
    'deploy',
    'README.md'
  ) | ForEach-Object { Copy-RepoItem $_ }

  Convert-StagedUnixLineEndings

  Compress-StagedPackage

  Invoke-NativeCommandWithRetry `
    -Action 'scp upload' `
    -Command 'scp' `
    -Arguments (@('-P', "$Port") + $SshOptions + @($ZipPath, "${Target}:$RemoteZip"))

  $RemoteScript = @'
set -euo pipefail

APP_DIR="$1"
START_KIOSK="$2"
REMOTE_ZIP="/tmp/mccb-manager-deploy.zip"
STAGE_DIR="/tmp/mccb-manager-deploy-$(id -u)-$$"

cleanup_stage_dir() {
  if [ -n "${STAGE_DIR:-}" ] && [ -d "$STAGE_DIR" ]; then
    chmod -R u+rwX "$STAGE_DIR" >/dev/null 2>&1 || true
    rm -rf "$STAGE_DIR" >/dev/null 2>&1 || true
  fi
}

trap cleanup_stage_dir EXIT

case "$APP_DIR" in
  "~")
    APP_DIR="$HOME"
    ;;
  "~/"*)
    APP_DIR="$HOME/${APP_DIR#~/}"
    ;;
  '$HOME'*)
    APP_DIR="$HOME/${APP_DIR#'$HOME'/}"
    ;;
esac

mkdir -p "$APP_DIR"
mkdir -p "$STAGE_DIR"
if command -v unzip >/dev/null 2>&1; then
  unzip -q -o "$REMOTE_ZIP" -d "$STAGE_DIR"
elif command -v python3 >/dev/null 2>&1; then
  python3 - "$REMOTE_ZIP" "$STAGE_DIR" <<'PY'
import sys
import zipfile

zip_path, stage_dir = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(zip_path) as archive:
    archive.extractall(stage_dir)
PY
else
  echo "Neither unzip nor python3 is installed on the Raspberry Pi. Install one of them before deployment." >&2
  exit 1
fi
cp -a "$STAGE_DIR"/. "$APP_DIR"/
mkdir -p "$APP_DIR/data/backups"
cd "$APP_DIR"
APP_DIR="$APP_DIR" ENABLE_KIOSK="$START_KIOSK" bash deploy/raspi/setup-system.sh

if [ "$START_KIOSK" = "1" ]; then
  if ! systemctl --user restart mccb-kiosk.service; then
    echo "kiosk service could not be started now. This is expected on Raspberry Pi OS Lite before Xorg is running."
    echo "Reboot the Raspberry Pi after Lite kiosk setup, or start Xorg and then run: systemctl --user restart mccb-kiosk.service"
  fi
fi

echo
echo "Deployment finished."
echo "Application URL:"
hostname -I | awk '{print "  http://"$1"/#/"}'
hostname -I | awk '{print "  http://"$1"/#/monitor"}'
echo
echo "Service status:"
for i in $(seq 1 12); do
  if systemctl is-active --quiet mccb-manager.service; then
    break
  fi
  sleep 1
done
systemctl status mccb-manager.service --no-pager -n 8 || true
if command -v nginx >/dev/null 2>&1; then
  systemctl status nginx --no-pager -n 5 || true
fi
'@

  $RemoteScript = $RemoteScript -replace "`r`n", "`n"
  $RemoteScript = $RemoteScript -replace "`r", "`n"
  [System.IO.File]::WriteAllText(
    $RemoteScriptPath,
    $RemoteScript,
    [System.Text.UTF8Encoding]::new($false)
  )

  Invoke-NativeCommandWithRetry `
    -Action 'remote script upload' `
    -Command 'scp' `
    -Arguments (@('-P', "$Port") + $SshOptions + @($RemoteScriptPath, "${Target}:$RemoteScriptFile"))

  Invoke-NativeCommandWithRetry `
    -Action 'remote deploy' `
    -Command 'ssh' `
    -Arguments (@('-tt', '-p', "$Port") + $SshOptions + @($Target, "bash '$RemoteScriptFile' '$AppDir' '$StartKioskValue'")) `
    -MaxAttempts 2
}
finally {
  if (Test-Path $TempRoot) {
    Remove-Item -Path $TempRoot -Recurse -Force
  }
}
