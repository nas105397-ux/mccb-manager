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
$RemoteZip = '/tmp/mccb-manager-deploy.zip'
$StartKioskValue = if ($StartKiosk.IsPresent) { '1' } else { '0' }

function Copy-RepoItem {
  param([string]$Path)

  $Source = Join-Path $RepoRoot $Path
  $Destination = Join-Path $StageDir $Path
  $DestinationParent = Split-Path $Destination -Parent

  New-Item -ItemType Directory -Force -Path $DestinationParent | Out-Null
  Copy-Item -Path $Source -Destination $Destination -Recurse -Force
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
    'ecosystem.config.cjs',
    'dist',
    'deploy',
    'README.md'
  ) | ForEach-Object { Copy-RepoItem $_ }

  Compress-Archive -Path (Join-Path $StageDir '*') -DestinationPath $ZipPath -Force

  scp -P $Port $ZipPath "${Target}:$RemoteZip"

  $RemoteScript = @'
set -euo pipefail

APP_DIR="$1"
START_KIOSK="$2"
REMOTE_ZIP="/tmp/mccb-manager-deploy.zip"
STAGE_DIR="/tmp/mccb-manager-deploy"

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
if ! command -v unzip >/dev/null 2>&1; then
  echo "unzip is not installed on the Raspberry Pi. Install it in the offline image before deployment." >&2
  exit 1
fi
rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR"
unzip -q -o "$REMOTE_ZIP" -d "$STAGE_DIR"
cp -a "$STAGE_DIR"/. "$APP_DIR"/
mkdir -p "$APP_DIR/data/backups"
cd "$APP_DIR"
APP_DIR="$APP_DIR" ENABLE_KIOSK=1 bash deploy/raspi/setup-system.sh

if [ "$START_KIOSK" = "1" ]; then
  systemctl --user restart mccb-kiosk.service
fi

echo
echo "Deployment finished."
echo "Application URL:"
hostname -I | awk '{print "  http://"$1"/#/"}'
hostname -I | awk '{print "  http://"$1"/#/monitor"}'
echo
echo "Service status:"
systemctl status mccb-manager.service --no-pager -n 8
if command -v nginx >/dev/null 2>&1; then
  systemctl status nginx --no-pager -n 5
fi
'@

  $RemoteScript | ssh -p $Port $Target "bash -s -- '$AppDir' '$StartKioskValue'"
}
finally {
  if (Test-Path $TempRoot) {
    Remove-Item -Path $TempRoot -Recurse -Force
  }
}
