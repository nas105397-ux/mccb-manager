param(
  [string]$Target = '',

  [string]$AppDir = '$HOME/mccb-manager',

  [int]$Port = 22,

  [switch]$SkipBuild,

  [switch]$StartKiosk,

  [switch]$KioskOnly,

  [switch]$BootstrapLite,

  [switch]$NoInstallNode,

  [string]$KeyPath = '',

  [ValidateSet('main', 'dual')]
  [string]$KioskMode = 'dual',

  [string]$MainGeometry = '1920x1080+0+0',

  [string]$DashboardGeometry = '3840x2160+1920+0',

  [string]$MainScale = '1',

  [string]$DashboardScale = '1.5',

  [string]$KioskHost = 'localhost',

  [string]$StaticIp = '',

  [string]$StaticGateway = '',

  [string]$StaticDns = '',

  [string]$StaticConnection = ''
)

$ErrorActionPreference = 'Stop'

function Write-DeployHeader {
  Write-Host ""
  Write-Host "============================================================" -ForegroundColor DarkCyan
  Write-Host " MCCB Manager - Raspberry Pi デプロイ" -ForegroundColor Cyan
  Write-Host "============================================================" -ForegroundColor DarkCyan
  Write-Host "  接続先        : $Target (ポート: $Port)"
  Write-Host "  インストール先: $AppDir"
  if ($BootstrapLite) { Write-Host "  初回セットアップ: あり" -ForegroundColor Yellow }
  if (-not [string]::IsNullOrWhiteSpace($StaticIp)) {
    Write-Host "  LAN 固定IP    : $StaticIp" -ForegroundColor Yellow
  }
  if ($KioskOnly) {
    Write-Host "  役割          : kiosk のみ（このPiにはサーバーを構築しません）" -ForegroundColor Yellow
    Write-Host "  接続先サーバー: https://$KioskHost/#/"
  } elseif ($StartKiosk) {
    Write-Host "  役割          : サーバー + kiosk ($KioskMode モード)" -ForegroundColor Yellow
    Write-Host "  kiosk URL     : https://$KioskHost/#/"
  } else {
    Write-Host "  役割          : サーバーのみ（kiosk なし）"
  }
  Write-Host "============================================================" -ForegroundColor DarkCyan
  Write-Host ""
}

function Write-Step {
  param([string]$Number, [string]$Message)
  Write-Host ""
  Write-Host "[$Number] $Message" -ForegroundColor Cyan
}

function Test-YesAnswer {
  param([string]$Answer)
  return $Answer -match '^(y|yes)$'
}

$IsInteractive = [string]::IsNullOrWhiteSpace($Target)

if ($IsInteractive) {
  Write-Host "============================================================" -ForegroundColor DarkCyan
  Write-Host " MCCB Manager - Raspberry Pi デプロイ" -ForegroundColor Cyan
  Write-Host "============================================================" -ForegroundColor DarkCyan

  Write-Step "1/5" "接続先の設定"
  $Target = Read-Host "接続先ユーザー@ホスト (例: pi@192.168.1.50)"
  if ([string]::IsNullOrWhiteSpace($Target)) {
    Write-Host "エラー: 接続先が必要です。" -ForegroundColor Red
    exit 1
  }

  $PortInput = Read-Host "SSH ポート番号 (そのままEnterで 22)"
  if (-not [string]::IsNullOrWhiteSpace($PortInput)) {
    $Port = [int]$PortInput
  }

  $KeyPathInput = Read-Host "SSH 鍵のパス (そのままEnterで自動検索)"
  if (-not [string]::IsNullOrWhiteSpace($KeyPathInput)) {
    $KeyPath = $KeyPathInput
  }

  Write-Step "2/5" "インストール先"
  $AppDirInput = Read-Host "Raspberry Pi 上のインストール先 (そのままEnterで `$HOME/mccb-manager)"
  if (-not [string]::IsNullOrWhiteSpace($AppDirInput)) {
    $AppDir = $AppDirInput
  }

  Write-Step "3/5" "初回セットアップ"
  Write-Host "  Lite OS パッケージ・Node.js・日本語入力(fcitx5-mozc)のインストールを行います。"
  Write-Host "  初回のみ必要です。2回目以降のデプロイでは N を選択してください。"
  $BootstrapAnswer = Read-Host "Lite OS の初回セットアップも実行しますか？ (y/N)"
  $BootstrapLite = Test-YesAnswer $BootstrapAnswer

  if ($BootstrapLite) {
    Write-Step "4/5" "LAN 固定IP設定"
    Write-Host "  Raspberry Pi の LAN アドレスを固定IPにします。不要なら空Enterでスキップします（DHCPのまま）。"
    Write-Host "  固定IPに変更すると、今回の接続先アドレスと異なる場合は SSH 接続が切れます。"
    $StaticIpInput = Read-Host "固定IPアドレス (例: 192.168.1.50/24、そのままEnterでスキップ)"
    if (-not [string]::IsNullOrWhiteSpace($StaticIpInput)) {
      $StaticIp = $StaticIpInput

      $StaticGatewayInput = Read-Host "デフォルトゲートウェイ (そのままEnterで設定なし)"
      if (-not [string]::IsNullOrWhiteSpace($StaticGatewayInput)) { $StaticGateway = $StaticGatewayInput }

      $StaticDnsInput = Read-Host "DNSサーバー (そのままEnterで設定なし。複数はスペース区切り)"
      if (-not [string]::IsNullOrWhiteSpace($StaticDnsInput)) { $StaticDns = $StaticDnsInput }

      $StaticConnectionInput = Read-Host "対象のネットワーク接続名 (そのままEnterで自動検出)"
      if (-not [string]::IsNullOrWhiteSpace($StaticConnectionInput)) { $StaticConnection = $StaticConnectionInput }
    }
  }

  Write-Step "5/5" "Pi の役割"
  Write-Host "  1) サーバーのみ         : このPiにアプリサーバーを構築します。画面出力なし（別PCやタブレットから見る）。"
  Write-Host "  2) サーバー + kiosk     : このPiにアプリサーバーを構築し、このPi自身の画面にも kiosk 表示します。"
  Write-Host "  3) kiosk のみ           : このPiにはサーバーを構築せず、別の Raspberry Pi の MCCB Manager サーバーへ接続して kiosk 表示だけ行います。"
  $RoleAnswer = Read-Host "役割を選択してください (1/2/3、そのままEnterで 1)"
  switch ($RoleAnswer) {
    '2' { $StartKiosk = $true; $KioskOnly = $false }
    '3' { $StartKiosk = $true; $KioskOnly = $true }
    default { $StartKiosk = $false; $KioskOnly = $false }
  }

  if ($StartKiosk) {
    Write-Host ""
    if ($KioskOnly) {
      Write-Host "kiosk のみの運用のため、接続先となるサーバー側 Raspberry Pi のホスト名/IPを指定してください（このPi自身のIPではありません）。"
      do {
        $KioskHostInput = Read-Host "サーバー側 Pi のホスト名/IP (例: 192.168.40.111)"
      } while ([string]::IsNullOrWhiteSpace($KioskHostInput))
      $KioskHost = $KioskHostInput
    } else {
      Write-Host "kiosk が開くURLのホスト/IPを指定します。Pi本体で自己完結する通常運用では localhost のままで問題ありません。"
      $KioskHostInput = Read-Host "kiosk URL のホスト/IP (そのままEnterで localhost)"
      if (-not [string]::IsNullOrWhiteSpace($KioskHostInput)) { $KioskHost = $KioskHostInput }
    }

    Write-Host ""
    Write-Host "kiosk モードを選択してください:"
    Write-Host "  main  - 操作画面のみ (1画面)"
    Write-Host "  dual  - 操作画面 + ダッシュボード (2画面、既定)"
    $KioskModeInput = Read-Host "kiosk モード (そのままEnterで dual)"
    if (-not [string]::IsNullOrWhiteSpace($KioskModeInput)) {
      if ($KioskModeInput -in @('main', 'dual')) {
        $KioskMode = $KioskModeInput
      } else {
        Write-Host "不明なモードのため既定の dual を使用します。" -ForegroundColor Yellow
      }
    }

    Write-Host ""
    Write-Host "画面サイズと配置は「幅x高さ+X位置+Y位置」の形式で指定します。"
    Write-Host "  例: 1920x1080+0+0     -> 1枚目の画面"
    Write-Host "  例: 1920x1080+1920+0  -> 1枚目の右に並ぶ2枚目"
    Write-Host "  例: 3840x2160+1920+0  -> 1枚目の右に並ぶ4K画面"
    $MainGeometryInput = Read-Host "メイン画面 (そのままEnterで $MainGeometry)"
    if (-not [string]::IsNullOrWhiteSpace($MainGeometryInput)) { $MainGeometry = $MainGeometryInput }

    $MainScaleInput = Read-Host "メイン画面スケール (そのままEnterで $MainScale)"
    if (-not [string]::IsNullOrWhiteSpace($MainScaleInput)) { $MainScale = $MainScaleInput }

    if ($KioskMode -eq 'dual') {
      $DashboardGeometryInput = Read-Host "ダッシュボード画面 (そのままEnterで $DashboardGeometry)"
      if (-not [string]::IsNullOrWhiteSpace($DashboardGeometryInput)) { $DashboardGeometry = $DashboardGeometryInput }

      $DashboardScaleInput = Read-Host "ダッシュボードスケール (そのままEnterで $DashboardScale)"
      if (-not [string]::IsNullOrWhiteSpace($DashboardScaleInput)) { $DashboardScale = $DashboardScaleInput }
    }
  }

  Write-Host ""
  Write-Host "============================================================" -ForegroundColor DarkCyan
  Write-Host " 実行内容の確認" -ForegroundColor Cyan
  Write-Host "============================================================" -ForegroundColor DarkCyan
  Write-Host " 接続先        : $Target"
  Write-Host " SSH ポート    : $Port"
  if (-not [string]::IsNullOrWhiteSpace($KeyPath)) { Write-Host " SSH 鍵        : $KeyPath" }
  Write-Host " インストール先: $AppDir"
  if ($BootstrapLite) {
    Write-Host " 初回セットアップ: あり（Lite OS パッケージ + Node.js + 日本語入力）"
  } else {
    Write-Host " 初回セットアップ: なし"
  }
  if (-not [string]::IsNullOrWhiteSpace($StaticIp)) {
    Write-Host " LAN 固定IP    : $StaticIp"
    if (-not [string]::IsNullOrWhiteSpace($StaticGateway)) { Write-Host "   ゲートウェイ : $StaticGateway" }
    if (-not [string]::IsNullOrWhiteSpace($StaticDns)) { Write-Host "   DNS         : $StaticDns" }
    if (-not [string]::IsNullOrWhiteSpace($StaticConnection)) { Write-Host "   接続名      : $StaticConnection" }
  } else {
    Write-Host " LAN 固定IP    : なし（DHCPのまま）"
  }
  if ($KioskOnly) {
    Write-Host " 役割          : kiosk のみ（このPiにはサーバーを構築しません）"
    Write-Host " 接続先サーバー: https://$KioskHost/#/"
    Write-Host " メイン画面    : $MainGeometry  スケール: $MainScale"
    if ($KioskMode -eq 'dual') { Write-Host " ダッシュボード: $DashboardGeometry  スケール: $DashboardScale" }
  } elseif ($StartKiosk) {
    Write-Host " 役割          : サーバー + kiosk（$KioskMode モード）"
    Write-Host " kiosk URL     : https://$KioskHost/#/"
    Write-Host " メイン画面    : $MainGeometry  スケール: $MainScale"
    if ($KioskMode -eq 'dual') { Write-Host " ダッシュボード: $DashboardGeometry  スケール: $DashboardScale" }
  } else {
    Write-Host " 役割          : サーバーのみ（kiosk なし）"
  }
  Write-Host "============================================================" -ForegroundColor DarkCyan
  Write-Host ""
  $Confirm = Read-Host "上記の設定でデプロイを開始しますか？ (y/N)"
  if (-not (Test-YesAnswer $Confirm)) {
    Write-Host "キャンセルしました。"
    exit 0
  }
}

if ($KioskOnly) {
  $StartKiosk = $true
  if ([string]::IsNullOrWhiteSpace($KioskHost) -or $KioskHost -eq 'localhost') {
    throw "KioskOnly では -KioskHost に接続先サーバー(別のRaspberry Pi)のホスト名/IPを指定してください。"
  }
}
$EnableServer = -not $KioskOnly.IsPresent

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) "mccb-manager-deploy-$([guid]::NewGuid())"
$StageDir = Join-Path $TempRoot 'package'
$ZipPath = Join-Path $TempRoot 'mccb-manager-deploy.zip'
$RemoteScriptPath = Join-Path $TempRoot 'mccb-manager-remote-deploy.sh'
$RemoteZip = '/tmp/mccb-manager-deploy.zip'
$RemoteScriptFile = '/tmp/mccb-manager-remote-deploy.sh'
$StartKioskValue = if ($StartKiosk.IsPresent) { '1' } else { '0' }
$EnableServerValue = if ($EnableServer) { '1' } else { '0' }
$BootstrapLiteValue = if ($BootstrapLite.IsPresent) { '1' } else { '0' }
$InstallJapaneseInputValue = if ($BootstrapLite) { '1' } else { '0' }
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

  if (-not $IsInteractive) {
    Write-DeployHeader
  }

  if ($EnableServer) {
    if (-not $SkipBuild) {
      Write-Step "1/4" "ビルド"
      if (-not (Test-Path (Join-Path $RepoRoot 'node_modules'))) {
        npm ci
      }
      npm run build
    }

    if (-not (Test-Path (Join-Path $RepoRoot 'dist'))) {
      throw 'dist was not found. Run without -SkipBuild first, or run npm run build.'
    }
  } else {
    Write-Step "1/4" "ビルド"
    Write-Host "kiosk のみのデプロイのため、ビルドはスキップします。"
  }

  Write-Step "2/4" "デプロイパッケージを作成"
  New-Item -ItemType Directory -Force -Path $StageDir | Out-Null

  if ($EnableServer) {
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
  } else {
    @(
      'deploy',
      'README.md'
    ) | ForEach-Object { Copy-RepoItem $_ }
  }

  Convert-StagedUnixLineEndings

  Compress-StagedPackage

  Write-Step "3/4" "Raspberry Pi へ転送"
  Invoke-NativeCommandWithRetry `
    -Action 'scp upload' `
    -Command 'scp' `
    -Arguments (@('-P', "$Port") + $SshIdentityOptions + $SshOptions + @($ZipPath, "${Target}:$RemoteZip"))

  Write-Step "4/4" "Raspberry Pi でセットアップ"

  $RemoteScript = @'
set -euo pipefail

APP_DIR="$1"
START_KIOSK="$2"
BOOTSTRAP_LITE="$3"
INSTALL_JAPANESE_INPUT="$4"
INSTALL_NODE="$5"
KIOSK_MODE="$6"
MAIN_GEOMETRY="$7"
DASHBOARD_GEOMETRY="$8"
MAIN_SCALE="$9"
DASHBOARD_SCALE="${10}"
KIOSK_HOST="${11}"
STATIC_IP="${12}"
STATIC_GATEWAY="${13}"
STATIC_DNS="${14}"
STATIC_CONNECTION="${15}"
ENABLE_SERVER="${16}"
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
if [ "$ENABLE_SERVER" = "1" ]; then
  mkdir -p "$APP_DIR/data/backups"
fi
cd "$APP_DIR"

if [ "$BOOTSTRAP_LITE" = "1" ]; then
  TARGET_USER="$(id -un)"
  echo "Running Raspberry Pi OS Lite bootstrap for $TARGET_USER..."
  sudo TARGET_USER="$TARGET_USER" \
    INSTALL_KIOSK="$START_KIOSK" \
    INSTALL_JAPANESE_INPUT="$INSTALL_JAPANESE_INPUT" \
    INSTALL_NODE="$INSTALL_NODE" \
    ENABLE_SERVER="$ENABLE_SERVER" \
    bash deploy/raspi/setup-lite-os.sh
fi

APP_DIR="$APP_DIR" \
  ENABLE_KIOSK="$START_KIOSK" \
  ENABLE_SERVER="$ENABLE_SERVER" \
  KIOSK_MODE="$KIOSK_MODE" \
  MAIN_GEOMETRY="$MAIN_GEOMETRY" \
  DASHBOARD_GEOMETRY="$DASHBOARD_GEOMETRY" \
  MAIN_SCALE="$MAIN_SCALE" \
  DASHBOARD_SCALE="$DASHBOARD_SCALE" \
  MCCB_KIOSK_HOST="$KIOSK_HOST" \
  bash deploy/raspi/setup-system.sh

if [ "$START_KIOSK" = "1" ]; then
  if ! systemctl --user restart mccb-kiosk.service; then
    echo "kiosk service could not be started now. This is expected on Raspberry Pi OS Lite before Xorg is running."
    echo "Reboot the Raspberry Pi after Lite kiosk setup, or start Xorg and then run: systemctl --user restart mccb-kiosk.service"
  fi
fi

echo
echo "Deployment finished."
if [ "$ENABLE_SERVER" = "1" ]; then
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
else
  echo "kiosk-only deployment. Connecting to server:"
  echo "  https://$KIOSK_HOST/#/"
fi
echo
echo "Kiosk status:"
if systemctl list-unit-files mccb-xsession.service >/dev/null 2>&1; then
  systemctl status mccb-xsession.service --no-pager -n 8 || true
else
  echo "mccb-xsession.service is not registered. Run with -BootstrapLite, or run setup-lite-os.sh on the Raspberry Pi."
fi
if [ "$START_KIOSK" = "1" ]; then
  systemctl --user status mccb-kiosk.service --no-pager -n 12 || true
  echo
  echo "Recent kiosk log:"
  journalctl --user -u mccb-kiosk.service --no-pager -n 30 || true
fi

if [ -n "$STATIC_IP" ]; then
  echo
  echo "Configuring LAN static IP..."
  sudo STATIC_IP="$STATIC_IP" \
    STATIC_GATEWAY="$STATIC_GATEWAY" \
    STATIC_DNS="$STATIC_DNS" \
    STATIC_CONNECTION="$STATIC_CONNECTION" \
    bash deploy/raspi/setup-static-ip.sh
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
    -Arguments (@('-tt', '-p', "$Port") + $SshIdentityOptions + $SshOptions + @($Target, "bash '$RemoteScriptFile' '$AppDir' '$StartKioskValue' '$BootstrapLiteValue' '$InstallJapaneseInputValue' '$InstallNodeValue' '$KioskMode' '$MainGeometry' '$DashboardGeometry' '$MainScale' '$DashboardScale' '$KioskHost' '$StaticIp' '$StaticGateway' '$StaticDns' '$StaticConnection' '$EnableServerValue'")) `
    -MaxAttempts 2

  Write-Host ""
  Write-Host "============================================================" -ForegroundColor DarkGreen
  Write-Host " デプロイ完了" -ForegroundColor Green
  Write-Host "============================================================" -ForegroundColor DarkGreen
  Write-Host ""
}
finally {
  if (Test-Path $TempRoot) {
    Remove-Item -Path $TempRoot -Recurse -Force
  }
}
