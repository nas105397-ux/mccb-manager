param(
  [Parameter(Mandatory = $true)]
  [string]$Target,

  [string]$AppDir = '$HOME/mccb-manager',

  [int]$Port = 22,

  [switch]$SkipBuild,

  [switch]$StartKiosk,

  [switch]$BootstrapLite,

  [switch]$InstallJapaneseInput,

  [switch]$NoInstallNode,

  [string]$KeyPath = ''
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
$BootstrapLiteValue = if ($BootstrapLite.IsPresent) { '1' } else { '0' }
$InstallJapaneseInputValue = if ($InstallJapaneseInput.IsPresent) { '1' } else { '0' }
$InstallNodeValue = if ($NoInstallNode.IsPresent) { '0' } else { '1' }
$DefaultKeyPath = "$HOME\.ssh\mccb_manager_ed25519"
if ([string]::IsNullOrWhiteSpace($KeyPath) -and (Test-Path $DefaultKeyPath)) {
  $KeyPath = $DefaultKeyPath
}
$SshIdentityOptions = @()
if (-not [string]::IsNullOrWhiteSpace($KeyPath)) {
  if (-not (Test-Path $KeyPath)) {
    throw "SSH key was not found: $KeyPath"
  }
  $SshIdentityOptions = @('-i', $KeyPath)
}
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

function Get-RuntimePackageNames {
  param([string[]]$RootPackageNames)

  $PackageLockPath = Join-Path $RepoRoot 'package-lock.json'
  $NodeScript = @'
const fs = require('node:fs');

const lockPath = process.argv[1];
const roots = process.argv.slice(2);
const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
const queue = [...roots];
const seen = new Set();

while (queue.length > 0) {
  const packageName = queue.shift();
  if (seen.has(packageName)) {
    continue;
  }
  seen.add(packageName);

  const packageInfo = lock.packages['node_modules/' + packageName];
  if (!packageInfo) {
    console.error(`Runtime dependency '${packageName}' was not found in package-lock.json.`);
    process.exit(1);
  }

  for (const dependency of Object.keys(packageInfo.dependencies || {})) {
    queue.push(dependency);
  }
}

console.log(JSON.stringify([...seen]));
'@

  $RuntimePackageJson = & node -e $NodeScript $PackageLockPath @RootPackageNames
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to resolve runtime dependencies from package-lock.json."
  }

  return $RuntimePackageJson | ConvertFrom-Json
}

function Copy-NodeModulePackage {
  param([string]$PackageName)

  $Source = Join-Path $RepoRoot "node_modules/$PackageName"
  if (-not (Test-Path $Source)) {
    throw "Runtime dependency '$PackageName' was not found in node_modules. Run npm ci and try again."
  }

  $Destination = Join-Path $StageDir "node_modules/$PackageName"
  $DestinationParent = Split-Path $Destination -Parent
  New-Item -ItemType Directory -Force -Path $DestinationParent | Out-Null
  Copy-Item -Path $Source -Destination $Destination -Recurse -Force
}

function Copy-RuntimeNodeModules {
  $RuntimePackageNames = Get-RuntimePackageNames -RootPackageNames @('cors', 'express')

  foreach ($PackageName in $RuntimePackageNames) {
    Copy-NodeModulePackage $PackageName
  }
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
    'server.js',
    'dbStore.js',
    'server',
    'src/shared',
    'dist',
    'deploy',
    'README.md'
  ) | ForEach-Object { Copy-RepoItem $_ }

  Copy-RuntimeNodeModules

  Convert-StagedUnixLineEndings

  Compress-StagedPackage

  Invoke-NativeCommandWithRetry `
    -Action 'scp upload' `
    -Command 'scp' `
    -Arguments (@('-P', "$Port") + $SshIdentityOptions + $SshOptions + @($ZipPath, "${Target}:$RemoteZip"))

  $RemoteScript = @'
set -euo pipefail

APP_DIR="$1"
START_KIOSK="$2"
BOOTSTRAP_LITE="$3"
INSTALL_JAPANESE_INPUT="$4"
INSTALL_NODE="$5"
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
  '~')
    APP_DIR="$HOME"
    ;;
  '~/'*)
    APP_DIR="$HOME/${APP_DIR#\~/}"
    ;;
  \$HOME)
    APP_DIR="$HOME"
    ;;
  \$HOME/*)
    APP_DIR="$HOME/${APP_DIR#\$HOME/}"
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

if [ "$BOOTSTRAP_LITE" = "1" ]; then
  TARGET_USER="$(id -un)"
  echo "Running Raspberry Pi OS Lite bootstrap for $TARGET_USER..."
  sudo TARGET_USER="$TARGET_USER" \
    INSTALL_KIOSK="$START_KIOSK" \
    INSTALL_JAPANESE_INPUT="$INSTALL_JAPANESE_INPUT" \
    INSTALL_NODE="$INSTALL_NODE" \
    bash deploy/raspi/setup-lite-os.sh
fi

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
if command -v nginx >/dev/null 2>&1; then
  hostname -I | awk '{print "  https://"$1"/#/"}'
  hostname -I | awk '{print "  https://"$1"/#/monitor"}'
else
  hostname -I | awk '{print "  http://"$1":5000/#/"}'
  hostname -I | awk '{print "  http://"$1":5000/#/monitor"}'
fi
echo
echo "Service status:"
for i in $(seq 1 12); do
  if systemctl is-active --quiet mccb-manager.service; then
    break
  fi
  sleep 1
done
systemctl status mccb-manager.service --no-pager -n 8 || true
systemctl status mccb-star-webusb.service --no-pager -n 8 || true
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
    -Arguments (@('-P', "$Port") + $SshIdentityOptions + $SshOptions + @($RemoteScriptPath, "${Target}:$RemoteScriptFile"))

  Invoke-NativeCommandWithRetry `
    -Action 'remote deploy' `
    -Command 'ssh' `
    -Arguments (@('-tt', '-p', "$Port") + $SshIdentityOptions + $SshOptions + @($Target, "bash '$RemoteScriptFile' '$AppDir' '$StartKioskValue' '$BootstrapLiteValue' '$InstallJapaneseInputValue' '$InstallNodeValue'")) `
    -MaxAttempts 2
}
finally {
  if (Test-Path $TempRoot) {
    Remove-Item -Path $TempRoot -Recurse -Force
  }
}
