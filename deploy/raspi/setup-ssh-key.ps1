param(
  [Parameter(Mandatory = $true)]
  [string]$Target,

  [int]$Port = 22,

  [string]$KeyPath = "$HOME\.ssh\mccb_manager_ed25519"
)

$ErrorActionPreference = 'Stop'

function Assert-NativeCommandSucceeded {
  param([string]$Action)

  if ($LASTEXITCODE -ne 0) {
    throw "$Action failed with exit code $LASTEXITCODE."
  }
}

$SshDir = Split-Path $KeyPath -Parent
$PublicKeyPath = "$KeyPath.pub"

if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
  throw 'ssh was not found. Install OpenSSH Client on Windows and try again.'
}

if (-not (Get-Command ssh-keygen -ErrorAction SilentlyContinue)) {
  throw 'ssh-keygen was not found. Install OpenSSH Client on Windows and try again.'
}

New-Item -ItemType Directory -Force -Path $SshDir | Out-Null

if (-not (Test-Path $KeyPath)) {
  Write-Host "Creating SSH key: $KeyPath"
  & ssh-keygen -t ed25519 -f $KeyPath -N '' -C "mccb-manager-deploy"
  Assert-NativeCommandSucceeded 'ssh-keygen'
}
elseif (-not (Test-Path $PublicKeyPath)) {
  Write-Host "Recreating public key: $PublicKeyPath"
  & ssh-keygen -y -f $KeyPath | Set-Content -NoNewline -Encoding ascii -Path $PublicKeyPath
}

Write-Host "Installing public key on $Target..."
Write-Host 'Enter the Raspberry Pi SSH password when prompted. This should be needed only once.'

$RemoteInstallCommand = @'
set -e
umask 077
mkdir -p "$HOME/.ssh"
touch "$HOME/.ssh/authorized_keys"
tmp_key="$(mktemp)"
cat > "$tmp_key"
if ! grep -qxFf "$tmp_key" "$HOME/.ssh/authorized_keys"; then
  cat "$tmp_key" >> "$HOME/.ssh/authorized_keys"
  printf '\n'
fi
rm -f "$tmp_key"
chmod 700 "$HOME/.ssh"
chmod 600 "$HOME/.ssh/authorized_keys"
'@

Get-Content -Raw -Path $PublicKeyPath | ssh -p $Port $Target $RemoteInstallCommand
Assert-NativeCommandSucceeded 'public key install'

Write-Host
Write-Host 'Testing key login...'
& ssh -i $KeyPath -p $Port -o BatchMode=yes -o ConnectTimeout=10 $Target 'echo SSH key login OK'
Assert-NativeCommandSucceeded 'SSH key login test'

Write-Host
Write-Host 'SSH key setup finished.'
Write-Host "Deploy commands can now use: -KeyPath `"$KeyPath`""
