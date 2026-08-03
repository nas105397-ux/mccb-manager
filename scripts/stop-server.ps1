# npm start で起動したサーバー（既定ポート5000、PORT環境変数で変更可）を停止する。
$port = if ($env:PORT) { $env:PORT } else { 5000 }

$connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if (-not $connections) {
    Write-Host "ポート $port で稼働中のサーバーは見つかりませんでした。"
    exit 0
}

$processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique
foreach ($processId in $processIds) {
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if ($process) {
        Write-Host "PID $processId ($($process.ProcessName)) を停止します..."
        Stop-Process -Id $processId -Force
    }
}

Write-Host "ポート $port のサーバーを停止しました。"
